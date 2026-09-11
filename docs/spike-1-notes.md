# Spike 1 — Web chat funnel end-to-end (Worker 1: deepseek-v4-flash)

Trace of `/s/<slug>` → `useChat` → `/api/chat` → `createBookingAgent` → tool outputs → persistence.
Goal: map exactly what is reusable vs web-specific, and how conversation/message identity + history would
translate to a phone-number-keyed (WhatsApp) channel. All citations are file:line in this worktree
(`ai@7.0.84`, `next@16.3.3`).

## 1. Findings

### 1.1 Page assembly — `src/app/s/[slug]/page.tsx`

- `page.tsx:15-17` loads school by slug via `getSchoolBySlug` (no public/approved filter at this layer), then
  enforces public-or-owner-preview access inline:
  - `page.tsx:22-27` `published = school.approvedAt != null && school.publishedAt != null`; if not published,
    only owner (verified session + `getOwnedSchool`) can view with `?preview=1`, else `notFound()`.
  - `page.tsx:33` `loadSchoolCatalog(school.id)` (offerings/windows/occurrences/faqs) and passes
    `catalog.offerings` into `BookingChat`.
  - `page.tsx:43-45` mounts `<LandingSession slug .../>` then `<BookingChat .../>`.
- Server→client split: the page is a server component; all interactivity (session, chat, booking) is client.

### 1.2 Landing session — `src/components/landing-session.tsx` + `src/app/api/sessions/route.ts`

- Client generates a **localStorage** token: `landing-session.tsx:7` key `fillthemat.session.<slug>`,
  `landing-session.tsx:29-35` stores `{token, exp}` with `exp = Date.now() + LANDING_SESSION_MINUTES*60_000`
  (30 min, `src/lib/schedule/constants.ts:8`), then POSTs `/api/sessions` with slug/token/utm on mount.
- `sessions/route.ts:11-16` requires `body.token.length >= 16`; looks school up by slug **without** an
  approved/published filter (any school by slug is found).
- `sessions/route.ts:38-43` `isKnownBot(user-agent)` sets `botExclusionReason`; qualified = `!preview && !bot
  && approvedAt != null && publishedAt != null`.
- `sessions/route.ts:50-55` insert `landingSessions` with `onConflictDoNothing` on `(schoolId, sessionKeyHash)`;
  on conflict, re-selects. Funnel event `session_qualified` is only written on the fresh-qualified path
  (`sessions/route.ts:82-90`).
- Session staleness: `sessions/route.ts:97-107` — if `lastSeenAt` is older than 30 min, it only updates
  `lastSeenAt` (does NOT re-qualify; comment at `sessions/route.ts:105-106`).
- **Keyed data model**: `landingSessions` is unique on `(school_id, session_key_hash)` — schema.ts:345.
  Created rows are never deleted by the sessions API (purge? none seen; only transcripts/conversations purge).

### 1.3 Chat component — `src/components/booking-chat.tsx`

- Conversation identity comes from **localStorage**, not the server:
  - `browser-token.ts:12-21` `conversationStorageKey(slug) = "fillthemat.conversation.<slug>"`;
    `readConversationToken(slug)` generates a 32-byte base64url token on first visit and persists it.
  - `booking-chat.tsx:38-45` `useEffect` on mount reads the token into state and refetches history from
    `GET /api/chat?slug&resumeToken` (`booking-chat.tsx:69-77`) — but the fetched payload is **ignored**
    (`void payload` + comment "History is reloaded from the server on refresh via GET; useChat starts empty
    and the first send continues the server-canonical transcript"). This is the documented "chat refresh
    recovery is incomplete" gap (`docs/v1-plan-remaining.md:23`).
- Transport: `booking-chat.tsx:47-57` `new DefaultChatTransport({ api: "/api/chat", prepareSendMessagesRequest:
  ({messages}) => ({ body: { slug, preview, resumeToken: readConversationToken(slug), message: messages.at(-1) }})})`.
  `ai@7.0.84`: `DefaultChatTransport extends HttpChatTransport` (dist/index.d.ts:5756-5759) sends HTTP
  POST + handles SSE streaming of `UIMessageChunk`. The `prepareSendMessagesRequest` hook injects the
  custom body fields (`use-chat` reference doc: `prepareSendMessagesRequest` `options`).
- Tool-result → booking UI bridge: `booking-chat.tsx:81-106` scans `message.parts` for
  `part.type === "tool-prepare_booking"` with `state === "output-available"` and reads `part.output`
  `{ok, offering:{id,name}, slot:{slotId,localDateLabel,localTimeLabel}}`; on success sets `prepared` +
  `setShowBook(true)`, replacing the chat input area with `<BookingFlow>`.

### 1.4 Chat API — `src/app/api/chat/route.ts`

POST sequence (line refs inside file):

1. `route.ts:34-38` size guard via `requestBodyTooLarge(content-length)` (`limits.ts:61-66`,
   `MAX_REQUEST_BYTES = 32_768`).
2. `route.ts:40-56` body parse `{slug, resumeToken, preview, message}`; rejects if no slug/resumeToken or
   `message.role !== "user"`; `textFromMessage` strips non-text parts; `MAX_USER_MESSAGE_CHARS = 2000`
   (`limits.ts:8`).
3. `route.ts:58-60` `getSchoolForLandingAccess(slug, {preview})` (`public.ts:29-46`): public school
   (approved+published) OR preview + owner session.
4. `route.ts:63-64` `tokenHash = hashToken(resumeToken)` (SHA-256 hex, `crypto.ts:7-9`).
5. `route.ts:66-105` conversation lookup by `(schoolId, resumeTokenHash)`; if missing, insert
   `{schoolId, resumeTokenHash, expiresAt: now + 30d}` with `onConflictDoNothing` on
   `conversations.resumeTokenHash` and a re-select; if the conflicting row belongs to a different school,
   returns 403 `invalid_conversation`. **A resume token is effectively single-school by first-wins.**
6. `route.ts:107-109` if `conversation.expiresAt <= now` → 410 `expired`.
7. `route.ts:111-122` claim lock: `update conversations set generatingAt=now where id=? and generatingAt is
   null`; no row claimed → 409 `generation_in_progress` (concurrency guard).
8. `route.ts:124-138` load stored messages ascending; `MAX_CHAT_MESSAGES_PER_CONVERSATION = 30`
   (`limits.ts:7`) → 429 `limit`; duplicate `messageId` check → 409 `duplicate`.
9. `route.ts:140-147` `loadSchoolCatalog(school.id)` then `validateUIMessages({messages: [...history,
   body.message]})` — `ai@7.0.84` re-validates UIMessage parts server-side (docs/04-ai-sdk-ui/03-chatbot-
   message-persistence.mdx:93 "you should validate them using validateUIMessages before sending them to the
   model").
10. `route.ts:150-158` insert user message `{conversationId, messageId, role:"user", parts, completion:
    "complete", purgeAt}` (respecting the DB unique `(conversation_id, message_id)`).
11. `route.ts:159-186` `persistAssistant({responseMessage, isAborted, outcome})` inserts the assistant
    message with completion `complete|aborted|error`, then clears `generatingAt`.
12. `route.ts:188-217` `isLocalAiStub()` (`dev-flags.ts:16-20`: non-prod + no `VERCEL_OIDC_TOKEN`) →
    `createUIMessageStreamResponse` with a deterministic stub string instead of calling the model.
13. `route.ts:219-233` otherwise `createAgentUIStreamResponse({agent, uiMessages, originalMessages,
    generateMessageId, consumeSseStream, onEnd: persistAssistant})`.
14. `route.ts:235-239` catch: clear `generatingAt`, rethrow.

GET (history): `route.ts:243-274` — slug/resumeToken → school access → conversation → messages →
`{messages: [{id, role, parts}]}`. `preview=1` supported.

### 1.5 Agent layer — `src/lib/ai/booking-agent.ts` + `system-prompt.ts` (channel-agnostic)

- `booking-agent.ts:29-38` `new ToolLoopAgent({ model: gateway(BOOKING_AGENT_MODEL || claude-sonnet-4.6),
  instructions: buildBookingAgentInstructions(...), stopWhen: isStepCount(MAX_AGENT_STEPS /* 8, limits.ts:10 */),
  providerOptions: { gateway: { tags: ["feature:booking-chat"], user: school.id } }, tools: {...} })`.
- Tools: `list_trial_offerings` (`booking-agent.ts:48-73`, age filter via `isAgeEligible`),
  `list_trial_slots` (`booking-agent.ts:74-97`, `listOpenSlots` from `occurrences.ts:77-145`,
  `SLOT_HORIZON_DAYS = 14`, `MIN_LEAD_MINUTES = 120`), `prepare_booking`
  (`booking-agent.ts:99-132`, "Revalidate an offering and slot and return data for the booking form. This does
  not create a booking.").
- System prompt immutable rules (`system-prompt.ts:1-10`): agent MAY answer/qualify/list/prepare but "You MUST
  NOT create a booking or a lead. Bookings and leads are created only by the platform confirmation forms."
  Tenant data wrapped in `<school_name>`-style delimiters and treated as untrusted (`system-prompt.ts:98-115`,
  `assertTenantCannotOverride` test at system-prompt.test.ts:7-31).

### 1.6 Persistence — `src/db/schema.ts`

- `conversations` (schema.ts:341-372): `id`, `schoolId` FK cascade, `landingSessionId` FK set-null,
  `contactId` FK set-null, `resumeTokenHash text NOT NULL`, `expiresAt NOT NULL`, `generatingAt`,
  `createdAt/updatedAt`; unique `conversations_resume_token_hash` **globally** (`schema.ts:356`), plus
  `(school_id, id)` unique. Note: the chat route never sets `landingSessionId` on the conversation row;
  landing-session linkage lives on the booking/lead row via a separately passed `landingSessionToken`.
- `messages` (schema.ts:375-396): `conversationId` FK cascade (one-way ref, no composite FK), `messageId text
  NOT NULL`, `role text`, `parts jsonb` (UIMessage parts), `completion enum`, `purgeAt NOT NULL`; unique
  `(conversation_id, message_id)`; index on `purge_at`.
- `contacts` (schema.ts:281-306): unique `(school_id, email)`; `email`, `name`, `phone` all NOT NULL.
- `landingSessions` (schema.ts:307-339): unique `(school_id, session_key_hash)`; `qualifiedAt`,
  `isPreview`, `botExclusionReason`, UTM columns.
- Purge: `maintenance.ts:52-73` `purgeExpiredTranscripts` deletes messages past `purgeAt` and conversations
  past `expiresAt` where `generatingAt` is null.

### 1.7 Outbound write hooks (see Spike 3)

`bookSlot` (book-slot.ts) and `POST /api/leads` insert `emailDeliveries` rows + funnel events; emails are
fired synchronously after commit via `attemptPendingForBooking` / `attemptPendingForLead`
(bookings/route.ts:66, leads/route.ts:118).

## 2. Evidence (quoted)

- Chat transport injection, `booking-chat.tsx:47-57`:
  ```ts
  new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { slug, preview, resumeToken: readConversationToken(slug), message: messages.at(-1) },
    }),
  }),
  ```
- History refetch is inert, `booking-chat.tsx:74-77`:
  ```ts
  // History is reloaded from the server on refresh via GET; useChat starts empty
  // and the first send continues the server-canonical transcript.
  void payload;
  ```
- Agent binding, `booking-agent.ts:38`: `stopWhen: isStepCount(MAX_AGENT_STEPS)` where
  `src/lib/security/limits.ts:10` `export const MAX_AGENT_STEPS = 8;`
- Immutable rule, `system-prompt.ts:7`: `- You MUST NOT create a booking or a lead. Bookings and leads are
  created only by the platform confirmation forms.`
- prepare_booking is a pure read, `booking-agent.ts:101-102`: `description: "Revalidate an offering and slot
  and return data for the booking form. This does not create a booking."`
- Conversation key + claim, `route.ts:111-116`:
  ```ts
  const claimed = await db.update(conversations).set({ generatingAt: now, updatedAt: now })
    .where(and(eq(conversations.id, conversation.id), isNull(conversations.generatingAt))).returning();
  if (!claimed[0]) return Response.json({ error: "generation_in_progress" }, { status: 409 });
  ```
- UIMessage server-side validation requirement, `docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx:93`:
  "When processing messages on the server that contain tool calls, custom metadata, or data parts, you should
  validate them using `validateUIMessages` before sending them to the model."
- `DefaultChatTransport` contract, `dist/index.d.ts:5756-5759`: class extends `HttpChatTransport`; docs
  `07-reference/02-ai-sdk-ui/01-use-chat.mdx:61`: "Defaults to DefaultChatTransport with `/api/chat` endpoint."
- Stub degradation, `dev-flags.ts:16-20`:
  ```ts
  export function isLocalAiStub(): boolean {
    return process.env.NODE_ENV !== "production" && !process.env.VERCEL_OIDC_TOKEN;
  }
  ```
- Refresh-gap acknowledgment, `docs/v1-plan-remaining.md:23`: "Chat refresh recovery is incomplete: GET
  `/api/chat` exists, but `useChat` does not hydrate canonical history on reload."

## 3. Contradictions / lacunae

- **"browser-cookie-derived" (kickoff prior art) vs actual**: the resume token is **localStorage**-derived
  (`browser-token.ts:12-21`), not a cookie. Same for landing session token (`landing-session.tsx:7-11`).
- `conversations.landingSessionId` is a declared FK (schema.ts:348, 362-366) but **no code path sets it**:
  `grep "landingSessionId" src/app/api/chat/route.ts` → none; `bookSlot` sets `conversations.contactId` only
  (book-slot.ts:293-301). Landing-session provenance is carried on bookings/leads/funnel_events instead.
- `chat_prepare` funnel event enum value exists (`funnel.ts:12`) but is never emitted anywhere — grep across
  `src/` shows only the constant. Tool-invocation telemetry is not written.
- "Conversation message cap" counts `messages` rows per conversation (`limits.ts:51-58`, used indirectly via
  `stored.length >= MAX`), but `conversationMessageCount` helper seems unused by chat route (chat uses the
  fetched `stored.length`).
- No per-school/IP request quota on chat (only message count + char caps, body size). `docs/v1-plan-
  remaining.md:30` notes WAF is application-side only, not configured in Vercel WAF.
- Preview chat: `getSchoolForLandingAccess` with `preview` requires a **verified owner session** — so chat is
  impossible for a previewing non-owner, and WhatsApp has no owner-session notion. Public chat requires
  approved+published school. `school_not_public` type exists only on the booking layer.
- `UIMessage` parts can include data/tool parts; text extraction for a text-only (WhatsApp) channel is
  trivial (`textFromMessage`) but structured slot/offering selection by the user would need a fork.

## 4. Risks & gotchas (WhatsApp-specific)

- **Identity swap**: web identity = per-slug localStorage token → `resumeTokenHash` (globally unique,
  first-school-wins). WhatsApp identity must be keyed by `wa_id` (Meta user) per school; the schema has no
  wa_id column and `resumeTokenHash NOT NULL` would need an alternative key (nullable or a new `channel_key`).
- **History is server-canonical but client-ignored**: GET exists; useChat does not hydrate. A WhatsApp
  channel cannot rely on the browser transport — a server-side driver must fetch stored messages itself and
  append the inbound message, i.e. the same `stored→validateUIMessages→agent` path used in POST, but driven
  by a webhook rather than the client.
- **generatingAt lock is a single-flight lock per conversation** (409 on overlap): a webhook may deliver
  duplicate/retried inbound messages; need message-id idempotency mapping to a `wamid` and queueing. If the
  agent runs inline in the webhook, the 24h send window + webhook timeout (Meta expects fast 200 ack,
  mimicked by resend webhook `MAX_BODY_BYTES` + fast ack pattern in ref: API/webhooks/resend/route.ts:5-9)
  push toward outbox + queue, not synchronous streaming.
- **Tool outputs are structured** (`prepare_booking` returns ok/offering/slot). The web UI renders a form;
  WhatsApp needs text/quick-reply-friendly rendering ("slot X at DATE TIME (N left)" then ask user to reply
  "book") — agent can produce that, but slot selection by free text is a UX + validation surface.
- **Concurrency**: the atomic booking write (`bookSlot`, see Spike 3) is reusable, but the chat path itself
  holds `generatingAt` during the whole agent run; an async WhatsApp adapter must clear it on abort/error
  exactly like `route.ts:235-239`.
- **30-message cap / 2000-char cap**: a WhatsApp conversation could be long-lived; the 30-message conversation
  cap would end WhatsApp chats abruptly with a 429 `limit` — needs product decision (reset on 24h window?).

## 5. Open questions to escalate (director)

1. Identity model: keep `resumeTokenHash` semantics for web; add a new nullable `waIdHash`/`channel` on
   `conversations` with a school+channel unique index? Or a per-school `(wa_id)` key?
2. Is the goal "WhatsApp user talks to the SAME agent" (reuse `createBookingAgent` wholesale — yes,
   channel-agnostic, verified) or "admin forwards school's WhatsApp to the agent"? Tenancy model decides
   phone_number_id↔school mapping.
3. Async driver: where does the agent run for inbound WhatsApp — inline in webhook (blocking, ack after run)
   vs outbox queue row (like `emailDeliveries`) consumed by cron? The existing harnesses are
   `createAgentUIStreamResponse` (SSE) and `createUIMessageStreamResponse`; both are HTTP-stream oriented
   and would need a non-streaming "run to completion, return parts" variant (`toUIMessageStream` /
   consume stream to completion) for a queue worker.
4. Preview: WhatsApp channel needs a "public only" rule (approved+published) since there is no owner session.