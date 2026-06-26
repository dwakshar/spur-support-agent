# Spur Support Agent

A live-chat support agent built as a take-home for Spur. Customers type questions, an AI grounded in a store FAQ replies instantly. No streaming, no websockets — just a clean request/response cycle that's easy to reason about and easy to extend.

The thing I wanted to get right architecturally: the core message pipeline knows nothing about HTTP or web chat specifically. A WhatsApp or Instagram adapter would call the exact same function. That felt like the most honest thing to build given what Spur actually does.

---

## Running locally

You'll need Node 18+ and a free [Neon](https://neon.tech) Postgres database.

**1. Clone and install**

```bash
git clone <repo-url>
cd spur-support-agent
npm install
```

**2. Set up environment variables**

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the two values (see the env vars section below).

**3. Run the database migration**

This creates the tables in your Neon database. You only need to do this once.

```bash
npm run db:migrate
```

**4. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The chat should be fully functional.

---

## Environment variables

| Variable | What it is | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key for Claude | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `DATABASE_URL` | Neon connection string | Neon dashboard → your project → **pooled** connection string |

Neither file is committed — `.env.local` is covered by `.gitignore`. Only `.env.example` with empty values is in the repo.

---

## Database setup

The migration file is already generated at `drizzle/0000_young_garia.sql`. Running `npm run db:migrate` applies it.

If you ever change the schema (`src/lib/db/schema.ts`), regenerate with:

```bash
npm run db:generate  # generates a new migration file
npm run db:migrate   # applies it
```

There's no seed data — the store FAQ lives in the system prompt, not the DB.

---

## Architecture

### The layers

```
Browser
  └── src/lib/api.ts               fetch helpers (typed, JSON-safe)
        └── POST /api/chat/message
              └── route.ts          Zod validation → error mapping → HTTP response
                    └── src/lib/channels/core.ts
                          ├── src/lib/db/repository.ts   all DB queries live here
                          └── src/lib/llm/generateReply.ts   only place SDK is called
```

The API route handles HTTP concerns: parse the body, validate it with Zod, call the core, map errors to the right status code. That's it.

The channel core (`handleInboundMessage`) does the actual work: resolve or create a conversation, fetch prior history, persist the user message, call the LLM, persist the reply, return the result. It doesn't know what HTTP is.

The repository is the only place that writes SQL. Routes and services never touch the DB directly.

### The channel-agnostic part

`handleInboundMessage` takes an `InboundMessage` — just `{ channel, sessionId?, text }` — and returns `{ reply, sessionId }`. The web chat route is one adapter. A WhatsApp adapter would be a sibling file that handles the webhook format and calls the same function with `channel: 'whatsapp'`. The DB schema already has a `channelEnum` for this.

### A few decisions worth calling out

**User message is persisted before the LLM call.** If the LLM times out or errors, the user's message is already in the DB. It doesn't get lost.

**The Anthropic SDK is behind a single function.** Only `generateReply.ts` imports it. Swapping providers means editing one file.

**The DB client is lazy.** It's initialized on first use, not at module load. This matters because Next.js imports route modules at build time — a top-level throw would break the build even with valid credentials at runtime.

**Session ID is the conversation UUID.** The `conversations.id` is what gets stored in `localStorage` and sent back with each request. No separate session table needed.

---

## LLM notes

**Provider:** Anthropic — `claude-haiku-4-5`. Haiku is fast and cheap enough for FAQ-style support replies where the answers are already written; no need for a bigger model.

**Prompting:** There's a hardcoded system prompt (`src/lib/llm/prompt.ts`) that embeds the full store FAQ — shipping times, return policy, support hours, order tracking. The model is instructed to answer only from that FAQ and, for anything not covered, to say it doesn't know and offer to connect the customer to a human agent. This prevents the model from inventing policies or making up order details.

**History:** The last 10 messages are included in each request as context. Older messages are dropped. This keeps costs predictable as conversations get long.

**Failure handling:** Every SDK failure — bad key, timeout (30s), rate limit, empty response — is caught and re-thrown as a typed `LLMError`. The route maps that to a `502` with a friendly message. The user never sees an internal error or a blank bubble.

---

## Trade-offs and what I'd do with more time

**No streaming.** This was a deliberate call. SSE streaming would improve the feel of responses — especially longer ones — but it adds complexity (different response handling on client and server, harder to test, more edge cases). For a timebox, synchronous was the right default.

**FAQ is hardcoded.** Embedding the knowledge in the system prompt is fine for a demo, but it doesn't scale. The next step would be a DB-backed knowledge base with a simple admin UI, and basic retrieval (keyword search or lightweight RAG with embeddings) so the prompt stays short even with a large knowledge base.

**No rate limiting.** Right now anyone can spam the endpoint and rack up API costs. I'd add per-IP rate limiting in Next.js middleware, and probably an Upstash Redis layer to cache repeated identical questions.

**No auth.** Session IDs are stored in plain `localStorage` and not tied to a user identity. For production you'd want sessions scoped to authenticated users and the `conversations` table to have a `userId` column.

**One channel.** The architecture is ready for more — it's really just a matter of writing the adapter and adding the channel to the enum. I'd build WhatsApp next since it's the most common support channel in markets like India.

**No tests.** I relied on TypeScript and manual testing to move fast. I'd add Vitest unit tests for `generateReply` (mocking the SDK client) and `handleInboundMessage` (mocking the repository), plus integration tests against a real test DB for the API routes.
