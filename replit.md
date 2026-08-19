# AskFlow AI

AskFlow AI is a secure workspace for authenticated users to create and continue Gemini-powered conversations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Supabase PostgreSQL with Row Level Security
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/askflow-ai` — React/Vite app
- `artifacts/api-server/src/routes/askflow.ts` — authenticated API routes and Gemini call
- `lib/api-spec/openapi.yaml` — API source of truth
- `supabase/migrations/001_askflow.sql` — tables and RLS policies

## Architecture decisions

- Supabase Auth issues the browser session; the API verifies the bearer token with Supabase Auth.
- The API uses the Supabase service-role key only on the server for user-scoped queries.
- Gemini is called from Express so neither the Gemini key nor service-role key reaches the browser.
- OpenAPI remains the source of truth for generated React Query and Zod contracts.

## Product

Users can sign up, log in, view conversation totals, create chats, and send messages to Gemini while their own history is persisted.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
