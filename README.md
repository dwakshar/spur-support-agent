# Northpeak Support — AI Live Chat Agent

A mini AI live-chat support agent built for the Spur take-home assignment. It lets customers ask questions about a fictional outdoor gear store (Northpeak) and get instant answers from an AI grounded in a hardcoded store FAQ. The architecture is synchronous request/response (no streaming, no websockets), built on a channel-agnostic core pipeline so additional channels (WhatsApp, Instagram) can be wired in as sibling adapters without touching the core logic — directly mirroring how Spur's multi-channel product works.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | Neon Postgres (serverless) + Drizzle ORM |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) |
| Validation | Zod v4 |

---

## Running Locally

**Prerequisites:** Node.js 18 or later.

```bash
# 1. Clone and install
git clone <repo-url>
cd spur-support-agent
npm install

# 2. Create a Neon database
#    Go to https://neon.tech, create a project, and copy the pooled connection string.

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in both values (see Environment Variables below)

# 4. Apply the database schema
npm run db:migrate

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `DATABASE_URL` | Neon dashboard → your project → Connection string (pooled) |

`.env` and `.env.local` are gitignored. Only `.env.example` (with empty values) is committed — no secrets are ever in the repo.

---

## Architecture Overview

### Request flow

```
Browser (page.tsx)
  └─ src/lib/api.ts          — typed fetch helpers, JSON parse guard
       └─ POST /api/chat/message
            └─ route.ts      — Zod validation, error classification → HTTP status
                 └─ src/lib/channels/core.ts  (handleInboundMessage)
                      ├─ src/lib/db/repository.ts  — all DB access (Drizzle)
                      └─ src/lib/llm/generateReply.ts  — sole Anthropic SDK callsite
```

### Channel-agnostic design

`handleInboundMessage()` in `src/lib/channels/core.ts` takes a normalized `InboundMessage` (channel, sessionId?, text) and returns an `OutboundResult` (reply, sessionId). It has no knowledge of HTTP. The web chat route is the first *adapter* — a WhatsApp or Instagram adapter would call the same function with `channel: 'whatsapp'` and sit alongside it as a sibling file. The `channelEnum` in the schema is already extended for this: adding a new channel is a two-line schema change.

The Anthropic SDK is imported in exactly one place: `src/lib/llm/generateReply.ts`. Nothing else touches it.

### Folder structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       ├── message/route.ts      POST — send a message
│   │       └── [sessionId]/route.ts  GET  — load session history
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   └── TypingIndicator.tsx
│   ├── page.tsx                      Chat UI (client component)
│   ├── layout.tsx
│   └── globals.css
└── lib/
    ├── api.ts                        Typed fetch helpers
    ├── channels/
    │   └── core.ts                   Channel-agnostic message pipeline
    ├── db/
    │   ├── client.ts                 Neon + Drizzle client
    │   ├── schema.ts                 Table + enum definitions
    │   └── repository.ts             All DB queries
    └── llm/
        ├── generateReply.ts          Anthropic SDK wrapper
        └── prompt.ts                 System prompt + FAQ
```

---

## Data Model

Two tables:

**`conversations`**
- `id` (uuid, PK) — this is the `sessionId` returned to and stored by the client
- `channel` (enum: `web_chat`) — which adapter created this conversation
- `createdAt`, `metadata` (jsonb, nullable for future use)

**`messages`**
- `id` (uuid, PK)
- `conversationId` (FK → conversations, cascade delete)
- `sender` (enum: `user` | `ai`)
- `text`, `createdAt`
- Indexed on `conversationId` — history is always fetched by conversation

---

## LLM Notes

- **Provider:** Anthropic Claude, model `claude-haiku-4-5`
- **Prompting:** A system prompt grounds the agent in a hardcoded Northpeak store FAQ covering shipping, returns, support hours, and order tracking. The model is instructed to answer only from the FAQ and offer to connect the customer to a human for anything not covered — this prevents hallucinated policies or invented order details.
- **History:** The last 10 messages are sent as context on each request. Older messages are dropped to keep token costs predictable.
- **Limits:** `max_tokens: 1024`, `timeout: 30s`. Any failure (timeout, rate limit, empty response, bad key) surfaces as `LLMError` and maps to a friendly `502` — the user never sees an internal error message.

---

## Robustness

All input is validated with Zod server-side before any business logic runs. Every API route is fully wrapped in `try/catch` — no unhandled promise rejections, no raw 500s, no stack traces to the client. See [SECURITY_AND_ROBUSTNESS.md](./SECURITY_AND_ROBUSTNESS.md) for a full case-by-case breakdown.

---

## Trade-offs & If I Had More Time

- **No streaming.** Claude supports SSE token streaming. I chose synchronous request/response for simplicity and reliability within the timebox. Adding streaming (via the Vercel AI SDK or a raw `ReadableStream`) would be the most impactful UX improvement.

- **FAQ is hardcoded in the system prompt.** For a real product this would move to a DB-backed knowledge base with a simple admin UI and retrieval (even naive keyword search or basic RAG with embeddings). The current approach is fine for a demo but doesn't scale to a real store with hundreds of policy pages.

- **No rate limiting or caching.** Under real load I'd add Redis (Upstash) in front of the LLM calls: rate-limit per IP, cache repeated identical questions, and dedup in-flight requests for the same session.

- **No auth.** Out of scope for this take-home. In production, sessionIds would be scoped to an authenticated user rather than stored in plain localStorage.

- **One channel implemented.** The architecture is ready — adding a WhatsApp adapter is a new file that calls `handleInboundMessage` with `channel: 'whatsapp'` and handles WhatsApp's webhook format. The schema's `channelEnum` needs one new value.

- **Minimal automated tests.** Given the timebox I relied on manual testing and TypeScript's type system. I'd add Vitest unit tests for `generateReply` (mocking the SDK), `handleInboundMessage` (mocking the repository), and integration tests hitting the actual endpoints against a test database.
