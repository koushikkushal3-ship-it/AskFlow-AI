import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { getGetConversationQueryKey, getGetDashboardQueryKey, getListConversationsQueryKey, useCreateConversation, useGetConversation, useSendMessage } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, Check, Clipboard, MessageSquare, MoreHorizontal, RefreshCw, Send, Sparkles, StopCircle } from 'lucide-react';
import { AppShell, PageEyebrow } from '@/components/askflow-shell';

function timeLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  async function copyMessage() {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); }
  }
  return <div data-testid={`message-${message.role}-${message.id}`} className={`group flex gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${isUser ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'}`}>{isUser ? 'YOU' : <Sparkles className="size-3.5" />}</div>
    <div className={`max-w-[min(680px,calc(100%-3rem))] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
      <div className={`rounded-2xl px-4 py-3.5 text-[13px] leading-6 sm:px-5 sm:py-4 sm:text-sm ${isUser ? 'rounded-tr-md bg-accent/10 text-foreground' : 'rounded-tl-md border border-border/70 bg-card text-foreground shadow-sm'}`}><p className="whitespace-pre-wrap">{message.content}</p></div>
      <div className={`mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/60 ${isUser ? 'flex-row-reverse' : ''}`}><span>{timeLabel(message.createdAt)}</span>{!isUser && <button type="button" data-testid={`button-copy-message-${message.id}`} onClick={copyMessage} className="inline-flex items-center gap-1 hover:text-foreground">{copied ? <Check className="size-3" /> : <Clipboard className="size-3" />}{copied ? 'Copied' : 'Copy'}</button>}</div>
    </div>
  </div>;
}

function TypingMessage() {
  return <div data-testid="status-assistant-thinking" className="flex gap-3 sm:gap-4 animate-fade"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="size-3.5" /></div><div className="rounded-2xl rounded-tl-md border border-border/70 bg-card px-5 py-4 shadow-sm"><div className="flex items-center gap-1.5"><span className="size-1.5 animate-pulse rounded-full bg-primary" /><span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" /><span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" /></div></div></div>;
}

export function ChatPage() {
  const params = useParams<{ conversationId?: string }>();
  const conversationId = params.conversationId;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const conversation = useGetConversation(conversationId || '', { query: { enabled: Boolean(conversationId), queryKey: getGetConversationQueryKey(conversationId || '') } });
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localTitle, setLocalTitle] = useState('');
  const [sendError, setSendError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const detailMessages = useMemo(() => conversation.data?.messages || [], [conversation.data?.messages]);
  const messages = conversationId ? (detailMessages.length ? detailMessages : localMessages) : localMessages;
  const isSending = createConversation.isPending || sendMessage.isPending;
  const isBlank = !conversationId && messages.length === 0;

  useEffect(() => {
    if (conversation.data) {
      setLocalTitle(conversation.data.title);
      setLocalMessages(conversation.data.messages);
    }
  }, [conversation.data]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isSending]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;
    setDraft('');
    setSendError('');
    const optimisticUser = { id: `pending-user-${Date.now()}`, role: 'user' as const, content, createdAt: new Date().toISOString() };
    setLocalMessages((current) => [...current, optimisticUser]);
    const deliver = (id: string) => sendMessage.mutate({ conversationId: id, data: { content } }, {
      onSuccess: (pair) => {
        setLocalMessages((current) => [...current.filter((message) => message.id !== optimisticUser.id), pair.userMessage, pair.assistantMessage]);
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      },
      onError: () => { setSendError('That message did not send. Your draft is safe — try again.'); setLocalMessages((current) => current.filter((message) => message.id !== optimisticUser.id)); setDraft(content); },
    });
    if (conversationId) deliver(conversationId);
    else createConversation.mutate({ data: { title: content.slice(0, 72) } }, {
      onSuccess: (created) => {
        setLocalTitle(created.title);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/chat/${created.id}`);
        deliver(created.id);
      },
      onError: () => { setSendError('We could not start a conversation. Please try again.'); setLocalMessages([]); setDraft(content); },
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
  }

  const suggestions = ['Help me untangle a complicated decision', 'Turn these rough notes into a clear plan', 'Explain something I keep getting wrong'];

  return <AppShell><div className="flex min-h-[calc(100dvh-4rem)] flex-col">
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border/70 px-5 md:px-10">
      <div className="flex min-w-0 items-center gap-3"><Link href="/dashboard" data-testid="link-chat-back" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /></Link><div className="min-w-0"><p className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-muted-foreground">Conversation</p><h1 data-testid="text-conversation-title" className="truncate text-sm font-bold">{localTitle || conversation.data?.title || 'New conversation'}</h1></div></div>
      <div className="flex items-center gap-1.5 text-muted-foreground"><button type="button" data-testid="button-scroll-latest" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })} className="rounded-md p-2 hover:bg-muted hover:text-foreground" aria-label="Scroll to latest"><ArrowDown className="size-4" /></button><button type="button" data-testid="button-chat-options" onClick={() => setSendError('Conversation options are coming soon.')} className="rounded-md p-2 hover:bg-muted hover:text-foreground" aria-label="Conversation options"><MoreHorizontal className="size-4" /></button></div>
    </header>
    {conversation.isError && conversationId ? <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-destructive/10"><MessageSquare className="size-5 text-destructive" /></div><h2 className="mt-4 font-editorial text-3xl">This conversation is out of reach.</h2><p data-testid="status-conversation-error" className="mt-2 text-sm text-muted-foreground">It may have been moved, or the connection needs another try.</p><button type="button" data-testid="button-retry-conversation" onClick={() => conversation.refetch()} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary underline"><RefreshCw className="size-3.5" />Try again</button></div> : <div ref={scrollRef} data-testid="chat-message-list" className={`scrollbar-subtle flex-1 overflow-y-auto px-5 md:px-10 ${isBlank ? 'flex' : ''}`}>
      {conversation.isLoading && conversationId ? <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">{[1,2,3].map((item) => <div key={item} className={`flex gap-3 ${item % 2 ? '' : 'flex-row-reverse'}`}><div className="size-8 animate-pulse rounded-full bg-muted" /><div className="h-20 w-3/5 animate-pulse rounded-2xl bg-muted" /></div>)}</div> : isBlank ? <div className="m-auto w-full max-w-2xl py-12"><div className="animate-rise"><PageEyebrow>A blank page</PageEyebrow><h2 data-testid="text-chat-welcome" className="mt-5 max-w-xl font-editorial text-5xl leading-[.98] tracking-[-.045em] sm:text-7xl">What are you working through?</h2><p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Bring a question, a rough idea, or a half-formed thought. AskFlow will help you make sense of it.</p></div><div className="mt-12 grid gap-2 sm:grid-cols-3">{suggestions.map((suggestion, index) => <button type="button" key={suggestion} data-testid={`button-suggestion-${index}`} onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }} className="group rounded-xl border border-border/80 bg-card p-4 text-left text-xs leading-5 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"><span className="mb-6 block font-mono-ui text-[10px] text-accent">0{index + 1}</span>{suggestion}<ArrowDown className="mt-4 size-3.5 rotate-[-45deg] text-primary opacity-0 transition group-hover:opacity-100" /></button>)}</div></div> : <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:gap-10 sm:py-12">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{isSending && <TypingMessage />}</div>}
    </div>}
    <div className="shrink-0 px-5 pb-5 pt-3 md:px-10 md:pb-8"><div className="mx-auto w-full max-w-2xl"><form onSubmit={submit} className="relative rounded-2xl border border-border bg-card p-2 shadow-[0_8px_30px_hsl(35_30%_25%_/_0.08)] transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"><textarea ref={inputRef} data-testid="input-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} rows={isBlank ? 3 : 2} maxLength={10000} placeholder="Ask anything worth thinking through…" className="max-h-40 min-h-[54px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground/60" /><div className="flex items-center justify-between px-2 pb-1 pt-2"><span className="font-mono-ui text-[9px] text-muted-foreground/60">Enter to send · Shift + Enter for a new line</span><button type="submit" data-testid="button-send-message" disabled={!draft.trim() || isSending} className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">{isSending ? <StopCircle className="size-4" /> : <Send className="size-4" />}</button></div></form>{sendError && <div data-testid="status-send-error" className="mt-2 flex items-center justify-between px-2 text-xs text-destructive"><span>{sendError}</span><button type="button" data-testid="button-dismiss-send-error" onClick={() => setSendError('')} className="text-destructive/70 underline">Dismiss</button></div>}<p className="mt-3 text-center text-[10px] text-muted-foreground/60">AskFlow can make mistakes. Check important details.</p></div></div>
  </div></AppShell>;
}