# AskFlow AI

AskFlow AI is a full-stack AI chat workspace with Supabase authentication, Supabase PostgreSQL persistence, and a secure Express backend that calls Gemini.

## Features

- Email/password signup, login, and logout
- Protected dashboard and chat routes
- Conversation and message history stored per user
- Row Level Security policies for conversations and messages
- Gemini calls made only on the server
- Responsive sidebar workspace with dashboard summary and full-page chat

## Setup

1. Create a Supabase project and copy the project URL and anon key.
2. Run `supabase/migrations/001_askflow.sql` in the Supabase SQL editor.
3. Create a Gemini API key.
4. Add the variables from `.env.example` to the shared environment:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - optionally `GEMINI_MODEL`
5. Add the browser-safe values from `artifacts/askflow-ai/.env.example` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Start the API and web workflows.

The service-role key and Gemini key must never be prefixed with `VITE_` and must never be committed or sent to the browser.

## Commands

```bash
pnpm install
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/askflow-ai run typecheck
pnpm --filter @workspace/api-server run dev
```

## Project map

- `artifacts/askflow-ai` — React/Vite web app
- `artifacts/api-server` — Express API and Gemini orchestration
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/api-client-react` and `lib/api-zod` — generated client and validation types
- `supabase/migrations` — Supabase schema and RLS policies