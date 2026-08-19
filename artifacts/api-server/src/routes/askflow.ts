import { GoogleGenAI } from "@google/genai";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateConversationBody,
  GetConversationParams,
  SendMessageResponse,
  SendMessageBody,
  SendMessageParams,
} from "@workspace/api-zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

type User = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
};

type AuthedRequest = Request & { askflowUser?: User; supabase?: SupabaseClient };

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return { url, serviceKey };
}

function adminClient() {
  const { url, serviceKey } = config();
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function authClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "there",
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

async function requireUser(req: AuthedRequest, res: Response) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ??
    (req as Request & { cookies?: Record<string, string> }).cookies?.askflow_access_token;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) {
    res.status(401).json({ error: "Sign in to continue" });
    return null;
  }
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Your session has expired" });
    return null;
  }
  req.askflowUser = data.user as User;
  return data.user as User;
}

function date(value: string | null | undefined) {
  return value ?? new Date().toISOString();
}

const router: IRouter = Router();

router.post("/auth/signup", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!email || password.length < 8 || !name) {
    res.status(400).json({ error: "Add a name, valid email, and password of at least 8 characters" });
    return;
  }
  try {
    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (data.session?.access_token) {
      res.cookie("askflow_access_token", data.session.access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }
    res.status(201).json({ needsEmailConfirmation: !data.session });
  } catch (error) {
    logger.error({ error }, "Failed to sign up");
    res.status(500).json({ error: "Unable to create your account" });
  }
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: "Enter your email and password" });
    return;
  }
  try {
    const { data, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      res.status(401).json({ error: error?.message ?? "Invalid email or password" });
      return;
    }
    res.cookie("askflow_access_token", data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    res.json({ user: publicUser(data.user as User) });
  } catch (error) {
    logger.error({ error }, "Failed to log in");
    res.status(500).json({ error: "Unable to sign you in" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("askflow_access_token", { httpOnly: true, sameSite: "lax" });
  res.status(204).end();
});

router.get("/auth/me", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(publicUser(user));
});

router.get("/dashboard", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const supabase = adminClient();
    const { count, error } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (error) throw error;
    res.json({ totalConversations: count ?? 0, user: publicUser(user) });
  } catch (error) {
    logger.error({ error }, "Failed to load dashboard");
    res.status(500).json({ error: "Unable to load your dashboard" });
  }
});

router.get("/conversations", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,created_at,updated_at,messages(id)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    res.json(
      (data ?? []).map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: date(conversation.created_at),
        updatedAt: date(conversation.updated_at),
        messageCount: Array.isArray(conversation.messages)
          ? conversation.messages.length
          : 0,
      })),
    );
  } catch (error) {
    logger.error({ error }, "Failed to list conversations");
    res.status(500).json({ error: "Unable to load conversations" });
  }
});

router.post("/conversations", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = CreateConversationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Conversation title is invalid" });
    return;
  }
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: parsed.data.title ?? "New conversation" })
      .select("id,title,created_at,updated_at")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      title: data.title,
      createdAt: date(data.created_at),
      updatedAt: date(data.updated_at),
      messageCount: 0,
    });
  } catch (error) {
    logger.error({ error }, "Failed to create conversation");
    res.status(500).json({ error: "Unable to create a conversation" });
  }
});

router.get("/conversations/:conversationId", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = GetConversationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Conversation id is invalid" });
    return;
  }
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,created_at,updated_at,messages(id,role,content,created_at)")
      .eq("id", parsed.data.conversationId)
      .eq("user_id", user.id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = [...(data.messages ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    res.json({
      id: data.id,
      title: data.title,
      createdAt: date(data.created_at),
      updatedAt: date(data.updated_at),
      messageCount: messages.length,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: date(message.created_at),
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to load conversation");
    res.status(500).json({ error: "Unable to load this conversation" });
  }
});

router.post("/conversations/:conversationId/messages", async (req: AuthedRequest, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = SendMessageParams.safeParse(req.params);
  const body = SendMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Message must be between 1 and 10,000 characters" });
    return;
  }
  try {
    const supabase = adminClient();
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id,title")
      .eq("id", params.data.conversationId)
      .eq("user_id", user.id)
      .single();
    if (conversationError || !conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversation.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(40);
    if (historyError) throw historyError;
    const { data: userMessage, error: userMessageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        role: "user",
        content: body.data.content,
      })
      .select("id,role,content,created_at")
      .single();
    if (userMessageError) throw userMessageError;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [
        ...(history ?? []).map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        { role: "user", parts: [{ text: body.data.content }] },
      ],
      config: {
        systemInstruction:
          "You are AskFlow AI, a thoughtful and concise assistant. Answer clearly, use markdown when useful, and never claim to have performed actions you cannot perform.",
      },
    });
    const assistantContent = response.text?.trim();
    if (!assistantContent) throw new Error("Gemini returned an empty response");
    const { data: assistantMessage, error: assistantError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
      })
      .select("id,role,content,created_at")
      .single();
    if (assistantError) throw assistantError;

    const title =
      conversation.title === "New conversation"
        ? body.data.content.slice(0, 54).trim() || "New conversation"
        : conversation.title;
    await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversation.id)
      .eq("user_id", user.id);

    const result = {
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: date(userMessage.created_at),
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: date(assistantMessage.created_at),
      },
    };
    res.json(SendMessageResponse.parse(result));
  } catch (error) {
    logger.error({ error }, "Failed to send AI message");
    res.status(500).json({ error: "AskFlow could not generate a reply right now" });
  }
});

export default router;