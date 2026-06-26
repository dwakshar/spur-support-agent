# spur-support-agent

Mini AI live-chat support agent. Synchronous request/response — no streaming, no websockets.

## Architecture

```
UI → API route → channel core → LLM service
                             → DB layer
```

- `src/lib/channels/core.ts` is the single entry point for processing a message. It persists the inbound message, builds history, calls `generateReply()`, persists the reply, and returns it. It knows nothing about HTTP.
- Web chat is the first channel adapter. WhatsApp/Instagram would sit alongside it as sibling adapters calling the same core.
- `src/lib/llm/generateReply.ts` is the only file that touches the Anthropic SDK.
- API routes handle HTTP concerns only — parse, validate, delegate to core, respond.

## Rules

- Validate all input at the API boundary with Zod. Routes never throw unhandled errors.
- LLM failures must be caught and return a typed error response, not a 500.
- No secrets committed. No auth. No features beyond the spec.
- Keep layers separate — no direct DB calls from API routes, no HTTP types in core.

## Stack

- Next.js 15 App Router + TypeScript
- Drizzle ORM + Neon Postgres
- Anthropic SDK (claude-sonnet-4-6)
- Zod
