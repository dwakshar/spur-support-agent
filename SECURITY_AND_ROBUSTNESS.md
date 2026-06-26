# Security & Robustness Notes

## Input / API

**1. Malformed/empty POST bodies**
All cases return a clean `{ error }` with 4xx — no unhandled throw:
- `""` / `"not json"` — `req.json()` throws, caught, returns 400 `{ error: "Invalid JSON body" }`
- `{}` — Zod safeParse fails (message missing), returns 400
- `{ message: "" }` — `.trim().min(1)` fails, returns 400 `{ error: "Message cannot be empty" }`
- `{ message: "   " }` — `.trim()` collapses to `""`, `.min(1)` fails, returns 400
- `{ message: 123 }` — `z.string()` rejects a number, returns 400
- `{ sessionId: "not-a-uuid", message: "hi" }` — `z.uuid()` rejects, returns 400

**2. 4000-character server-side limit**
Enforced in the Zod schema on the route, not just the client. Direct `curl` requests are subject to the same check.

**3. GET /api/chat/[sessionId] validation**
- Non-UUID path param → `z.uuid()` rejects → 400 `{ error: "Invalid session ID" }`
- Valid UUID not in DB → `getConversation()` returns null → 404 `{ error: "Session not found" }`

**4. All API responses are JSON**
Every code path in both routes calls `NextResponse.json(...)`. In `src/lib/api.ts`, JSON parsing is wrapped in `parseJSON()` which catches parse errors and returns `{}`, so `response.json()` never throws into the caller. Unexpected non-JSON responses from the server produce a generic client-side error string.

## LLM Layer

**5. LLM failure modes → LLMError → 502**
All of the following surface as `LLMError` and are mapped to `502` by the route:
- Missing `ANTHROPIC_API_KEY` — checked before the SDK is instantiated, throws `LLMError` immediately
- Invalid key / 401 from Anthropic — SDK throws, caught in `generateReply`, re-thrown as `LLMError`
- Request timeout — SDK configured with `timeout: 30_000`; timeout throws, caught, re-thrown as `LLMError`
- Rate limit (429) — SDK throws `APIError`, caught, re-thrown as `LLMError`
- Empty content blocks — after filtering and joining, an empty/whitespace result throws `LLMError("Model returned an empty response")` rather than returning an empty bubble

**6. History cap**
`history.slice(-10)` is applied before the API call in `generateReply`. At most 10 prior messages are sent to the model regardless of conversation length.

## Secrets / Config

**7. No secrets in the repo**
- `.env` is matched by `.env*` in `.gitignore` and is not tracked
- `.env.example` contains only empty placeholders (`ANTHROPIC_API_KEY=`, `DATABASE_URL=`)
- `grep` for `sk-ant` or assigned key patterns finds nothing in source files
- No API key is included in any log line, error response, or client-side code

**8. Missing env vars fail clearly**
- `DATABASE_URL` missing → `src/lib/db/client.ts` throws `Error("DATABASE_URL is not set")` at module init
- `ANTHROPIC_API_KEY` missing → `generateReply()` throws `LLMError("ANTHROPIC_API_KEY is not set")` before the SDK is touched; the route returns 502 with a user-friendly message, no key name or value leaks to the client

## Stability

**9. No unhandled promise rejections**
Both API routes wrap all `await` calls in `try/catch`. The outer catch in the POST route has three branches (SessionNotFoundError, LLMError, anything else) and always returns a JSON response. The GET route's catch returns a generic 500 JSON response.

**10. No double-fire / permanent lock**
The send button and textarea are both `disabled` while `isLoading === true`. `setIsLoading(false)` is called in both the success path and every error branch of `handleSend`, so a network failure, LLM error, or session error always re-enables the input. There is no code path that sets `isLoading` to `true` without a corresponding `false`.
