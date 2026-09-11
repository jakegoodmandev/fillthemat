# Spike 2 — Outbound messaging + webhook/queue infra (notes)

Evidence-backed read of the existing email-delivery infrastructure, mapped to what a
WhatsApp Cloud API outbound + inbound/status channel would need. No code proposed;
this is **intake** for the Director's phased plan.

## 1. Findings

### 1a. Outbound queue — `email_deliveries` table

- `src/db/schema.ts:266-308` (table) declares a Postgres enum-driven state
  machine: `pending → claimed → sent → delivered|bounced|complained`, plus
  `failed` (with `attempts`, `nextAttemptAt`) for retry.
- `nextBackoff(attempts)` doubles per attempt, capped at 60 minutes
  (`src/lib/email/deliveries.ts:7`).
- The row carries a **provider-side idempotency key** (text column with a unique
  constraint): `providerIdempotencyKey`. Keys by convention include the resource
  + sequence: `booking-confirmation/${id}`, `owner-booking/${id}`,
  `booking-cancellation/${id}/${nextSequence}`, `booking-reminder/${id}`
  (see `src/lib/schedule/book-slot.ts:286-313` and
  `src/lib/email/maintenance.ts:34-48`).
- Provider message id is recorded in `providerId` after successful send
  (`src/lib/email/deliveries.ts:122-130`) — Resend stores its own message id
  here so the inbound webhook can correlate.

### 1b. Outbound worker — `claimDueDeliveries` + `runMaintenance`

- Claiming is **POSTGRES-FOR-UPDATE-SKIP-LOCKED**:
  `src/lib/email/deliveries.ts:228-256` opens a transaction, selects
  pending|failed rows whose `nextAttemptAt <= now()`, locks them with
  `.for("update", { skipLocked: true })`, and stamps `state="claimed"`,
  `claimedAt`, `claimedBy = runId`. Multiple cron workers + per-request
  workers (`attemptPendingForBooking` / `attemptPendingForLead`) cannot
  double-send.
- The route handler at `src/app/api/cron/maintenance/route.ts:6-17` only exports
  `GET`; auth is by `cronSecretMatches` reading `Authorization: Bearer ${CRON_SECRET}`
  (`src/lib/request.ts:25-30`). Schedule is `0 14 * * *` UTC daily in
  `vercel.ts:7` (also documented in `docs/v1-deploy-current.md:93` and
  approved in `docs/v1-plan.md:132`).
- After claiming, `runMaintenance` (`src/lib/email/maintenance.ts:79-100`)
  iterates each delivery and calls `sendDelivery`, then writes a row to
  `cron_runs` (`src/db/schema.ts:330-345`) with `reminderCount`, `sentCount`,
  `failedCount`, `purgedCount`. Errors write `result="error"`,
  `errorSummary`.
- Inline "try now" workers exist at two POST sites
  (`src/app/api/bookings/route.ts:66`,
  `src/app/api/leads/route.ts:118`,
  `src/app/dashboard/bookings/actions.ts:45`) that re-attempt all pending
  rows for a just-created booking/lead. Same table, same row-state rules —
  no second state machine.

### 1c. Inbound webhook — `/api/webhooks/resend`

Route at `src/app/api/webhooks/resend/route.ts:7-49`:
- Rejects early when `RESEND_WEBHOOK_SECRET` unset (returns 500 `unconfigured`).
  This means a missing config proves uninstallability **before** any deserialization.
  **Pattern worth copying.**
- Reads the **raw body as text** (`await request.text()`) and caps it to
  `MAX_BODY_BYTES = 64_000` (line 7). Returns 413 above that. This is required
  because Resend svix signatures are computed over the raw request body, before
  any JSON parse.
- Calls SDK verification: `getResend().webhooks.verify({ payload, headers, webhookSecret })`
  and maps events (`email.delivered/bounced/complained`) to the same enum the
  queue uses (`delivered/bounced/complained`).
- Lookup via `providerId` = `(event.data.email_id).toString()`. Updates state
  by `WHERE providerId = $1` (`src/app/api/webhooks/resend/route.ts:40-46`).
- Returns `{ ok: true }` quickly. Even unknown events ack 200 with no DB write
  (lines 26-27).

### 1d. Local dev degradability — `src/lib/dev-flags.ts`

Four predicates branching on `process.env.NODE_ENV !== "production"`:
- `isDevEmailAuthEnabled()` — `NEXT_PUBLIC_DEV_AUTH === "true"`.
- `allowSelfApproval()` — `ALLOW_SELF_APPROVAL === "true"`.
- `isLocalEmailNoop()` — `!RESEND_API_KEY`.
- `isLocalAiStub()` — `!VERCEL_OIDC_TOKEN`.

The local noop **still completes the queue workflow**: it logs the recipient
and stamps the row as `sent`
(`src/lib/email/deliveries.ts:96-110`). This is the contract that any new
vendor adapter must match — dev must be **forward-moving on the same rows** so
the cron + table indexes are exercised in CI/local without a real key.

`scripts/setup-local.ts` does **not** currently write `RESEND_FROM`,
`RESEND_WEBHOOK_SECRET`, `VERCEL_OIDC_TOKEN`, etc.; the setup script is
honest about bootability vs. opt-in fidelity (`scripts/setup-local.ts:68-86`).

## 2. Evidence (verbatim)

> `nextBackoff(attempts: number): Date { const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1)); … }`
> — `src/lib/email/deliveries.ts:5-9`

> `state: emailStateEnum("state").notNull().default("pending")`
> — `src/db/schema.ts:284`

> `providerIdempotencyKey: text("provider_idempotency_key").notNull(),`
> + `unique("email_deliveries_provider_key").on(t.providerIdempotencyKey),`
> — `src/db/schema.ts:285, 296`

> `.for("update", { skipLocked: true })`
> + write `claimedBy: runId`
> — `src/lib/email/deliveries.ts:243, 252`

> `if (!secret) return Response.json({ error: "unconfigured" }, { status: 500 });`
> + `const payload = await request.text();`
> + `if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) …`
> — `src/app/api/webhooks/resend/route.ts:9-14`

> `if (isLocalEmailNoop()) { … await db.update(emailDeliveries).set({ state: "sent", providerId: \`local-noop:${delivery.id}\`, … });`
> — `src/lib/email/deliveries.ts:96-110`

> `crons: [{ path: "/api/cron/maintenance", schedule: "0 14 * * *" }],`
> — `vercel.ts:7`

## 3. How this maps onto WhatsApp Cloud API outbound + inbound

### Outbound

- Reuse the same Postgres state machine verbatim. A new
  `whatsapp_deliveries` table whose `state` is a string-typed union
  (`pending|claimed|sent|delivered|read|failed`) maps 1:1, including the same
  `for("update", { skipLocked: true })` claim pattern. The Director likely
  wants this **as a parallel table** (not a unified `deliveries` table) so the
  contact identity (wa_id/phone) lives alongside channel-specific render and
  template columns. Migration is additive.
- `providerIdempotencyKey` becomes the **business key**
  (e.g. `wa-outbound/${kind}/${id}/${sequence}`). Meta does not require a
  client-supplied idempotency header on `/messages`, but **broker-side**
  deduplication is essential to avoid duplicate sends during cron retries or
  webhook ack failures.
- `providerId` becomes Meta's **`messages[].id`** (`wamid.HBgL…`, the
  Reference provided in the Get Started doc). The 24-hour window itself is
  bound to a `conversations[].id` exposed via the `messages` endpoint and the
  `conversation` webhook field; we want both on the row for idempotent
  "open 24h window" lookup.
- **Sending patterns (verbatim from provided doc):**
  - Free-form requires the user to have messaged us in the last 24h; out of
    window and we must fall back to a **template message** (the marketing /
    utility / authentication namespace). The state machine must therefore be
    aware of *which template* it just sent and not silently retry sending the
    same body four times after a 24h expiry — it needs to choose a template
    on retry-or-fallback.
  - `Authorization: Bearer <SYSTEM_USER_ACCESS_TOKEN>` is the only auth
    channel. The system-user token has scopes
    `business_management, whatsapp_business_messaging,
    whatsapp_business_management`. We cannot put it in a `BEGIN/END PUBLIC KEY`
    env file; it lives in `process.env.WHATSAPP_SYSTEM_USER_TOKEN`.
  - Send endpoint shape (from doc): `POST
    https://graph.facebook.com/v23.0/<phone_number_id>/messages` with body
    `{messaging_product:"whatsapp", recipient_type:"individual", to, type,
    text:{body}}` for free-form; template messages swap `type:"template"`
    with `template:{name, language:{code}, components:[…]}`.
- **Reply context for the booking agent.** Inbound replies might literally be
  the prospect picking a date like "1". Meta gives text + button payload +
  context metadata. We will receive `messages[].type`, `text.body`,
  `interactive.button_reply.id` / `interactive.list_reply.id`, plus
  `context.from` (a `wamid.*` of the message we're replying to). That gives us
  a clean state-machine handle for conversational flows: store the parent
  bot-message id on the row so when a button reply comes in we look up the
  outbound delivery and continue the flow.
- **24-hour window check on cron retries.** Today the cron runs **once per
  day at 14:00 UTC** (`vercel.ts`). That schedule cannot react to the
  rolling 24h expiry on the conversation. A WhatsApp-sourced retry schedule
  needs to be coarser-grain OR event-driven: the safest pattern is
  - Send immediately on a *new outbound requirement*
    (`scheduleMessage`, but actually `send` immediately for non-template)
  - Use the cron only as **fair-share retry** for messages that have a
    `nextAttemptAt` already; abandon after a small number of retries if the
    window closed and we cannot fall back to a template
- **Status updates.** Meta posts `sent|delivered|read|failed` to our
  `/webhooks`. They arrive asynchronously; same pattern as Resend webhook →
  `whatsapp_deliveries.state` column.
- **Status mapping for our system:**
  - `accepted` (Meta 200 OK, has wamid) → `sent`
  - `delivered` → `delivered`
  - `read` → `read`
  - `failed` (recipient phone off, blocked, etc.) → `failed` with
    `lastError` set to the Graph error code (e.g. `"recipient_not_in_window"`).
- Templates: Meta requires pre-approved template messages for *out-of-window*
  sends. Day-1 design should pick a small number of templates per school
  (e.g. `"trial_followup_one"`, `"reminder_24h"`,
  `"lead_captured_followup"`) and store their name + language code in a
  per-school config row. The Director needs to weigh whether we ship
  templates per tenant (one Meta app per school will scale-defeat) or reuse
  a Fillthemat-owned template set.

### Inbound

- The `/api/webhooks/whatsapp` route resembles Resend's:
  - **GET** with `hub.mode`, `hub.verify_token`, `hub.challenge` (per
    Reference doc Step 4). Same posture as the Resend route: when
    `WHATSAPP_VERIFY_TOKEN` missing → 500 `unconfigured`. When the
    `hub.verify_token` matches env → return `hub.challenge` **as
    `text/plain`**, not JSON, with HTTP 200.
  - **POST** with `X-Hub-Signature-256: sha256=<hmac_sha256(app_secret, raw_body)>`
    header. **Body must be the raw text**, capped (use the same 64k cap or
    Meta defaults). Verification: `crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex")`
    → string-equality compare with `signature.replace(/^sha256=/, "")`
    inside `crypto.timingSafeEqual`. Same early-return structure as
    `src/app/api/webhooks/resend/route.ts:8-21`.
- Ack fast: Meta expects 200 within a few seconds. Pull the row id, persist
  via `whatsapp_deliveries` insert (unique on `wa_message_id`, idempotency
  key), then return 200.
- Persist the message: write to a new `messages` table row (or reuse existing
  one) keyed by conversation-identified by **whatsapp phone number_id +
  contact wa_id** (not by `resumeTokenHash` like web). The contact is the
  business identifier; the conversation key is `phone_number_id + wa_id`.
  Web funnel maps `resumeTokenHash` (cookie-derived) to `conversation`; we
  need to define how the conversation gating (`generating_at` reentrancy) is
  applied when WhatsApp deliver comes from the same number across two
  simultaneous Meta deliveries.

### Worker authorization & scope

- The Meta system-user token **must** be the same scopes as the agency call
  provides. Today we ship "managed" Resend for outbound; a similar "managed"
  shape works for WhatsApp: one Meta app owned by Fillthemat, each pilot
  school is configured with `phone_number_id` + `waba_id` in the DB, and the
  app stores the shared `WHATSAPP_APP_SECRET` / `WHATSAPP_SYSTEM_USER_TOKEN`
  in env. Per-school `phone_number_id` selection lets us attribute
  conversations to a school deterministically.

## 3. Contradictions / lacunae

- **Cron cadence is too slow for 24h-window UX.** Daily 14:00 UTC means a
  outbound to a cool user would miss the user's 24h window before the cron
  catches up. The Director must decide to add a second cron entry or push
  send to inline-on-create (good default).
- **No webhook replay harness exists.** `scripts/` has no
  `webhook-replay.ts` style file. Today the Resend webhook ships programmatic
  verification (`webhooks.verify()`) provided by the Resend SDK; if we want a
  local test that POSTs a fabricated payload, we have to write the signature
  ourselves and have a route that consumes the *exact* shape. This is reusable
  infra: a `bun scripts/webhook-replay.ts whatsapp` reads a JSON fixture,
  computes `X-Hub-Signature-256`, POSTs.
- **Distinction of "delivered vs. failed" per recipient isn't in
  `email_deliveries`.** For WhatsApp we need explicit per-delivery state for
  `read` and `delivered`; reusing the same enum (which already supports
  delivered/bounced/complained) is fine — no schema change needed for the
  outbound `state` enum, but we should add `read` if we also want read-receipts.
- **Per-school phone_number_id attribute is missing.** Schema has
  `school.phone` (free text) but no `phone_number_id` or `waba_id`. New column(s)
  needed (worktree lead: how many school-phone columns do we need; whether
  one shared WABA serves all schools; the case where one school has multiple
  numbers; whether we store normative E.164; whether we store `display_phone_number`).
  And `WHATSAPP_*` env names + verification/handshake token.

## 4. Risks & gotchas (specific to WhatsApp + local + prod)

- **Verify-handshake needs `text/plain`.** Many route handlers in this repo
  default to JSON. The Meta GET verify challenge requires the *exact literal
  challenge string* in the body. Easy to get wrong; trivial to test.
- **`X-Hub-Signature-256` is HMAC-SHA256 over the raw body, in hex, prefixed
  with `sha256=`.** `crypto.timingSafeEqual` requires equal-length buffers.
  Length mismatch is a 401, not a 500. Always pass `Buffer.from(hex, "hex")`
  on each side.
- **Meta webhook subscriptions are per-app + per-WABA.** Step 4 "Set up
  test webhook" is per-app; in production we expect one app → many WABAs.
  Each WABA needs to be subscribed in API Setup. A school onboarding
  webhook without a prior subscription just gets nothing.
- **Webhook GET verification and POST signature share `WHATSAPP_APP_SECRET`.**
  The verify_token in GET is a string we configure, **not** the app secret.
  Easy to mix them up at env-time.
- **Multiple deliveries per webhook.** Meta will retry if our 200 is slow or
  the POST fails. Our idempotency by `wa_message_id` (unique constraint) is
  the safety net. We must never blanket-200-then-write; we write and 200,
  or write-fail-then-5xx.
- **Window expiry is silent.** Meta returns `messages[].id` (the wamid)
  even when the send claim is impossible; the 24h expiry manifests as an
  error string like `(#131030) Recipient is in a window of 24 hours` only at
  *send*, not before. To detect expiry cheaply we must rely on the previous
  inbound `messages.timestamp` and `expires_at` *or* attempt the send first
  and fall back. We cannot blindly template a message and skip window
  verification.
- **Cost / template approval.** Out-of-window sends use templates; templates
  need Meta approval per language per namespace. The Director must decide if
  Fillthemat hosts a library of pre-approved templates, or if onboarding a
  school waits for the school to supply approved templates.
- **GDPR / opt-in.** A WhatsApp Business account can only message a number
  who has opted in. Today's prospect flow does not collect a phone number
  (only email + name). A WhatsApp-first flow needs an explicit opt-in
  confirmation prompt before forwarding any template; the channel must not
  silently pre-fill `contacts.phone` from `/s/<slug>` HTML scraping.
- **`messages.timestamp` is a unix-second string.** Date math in our
  `appointment_slot` system already uses ISO; convert carefully.
- **Two parallel local webhook queues.** If the local dev noop marks
  `whatsapp_deliveries.state="sent"` while the local POST still receives a
  webhook, the resulting row state machine will appear stuck. Local noop
  must log + simulate any inbound `delivered/read` event for at least one
  tick so tests can observe terminal states.
- **Inbound `context.from` wamid presence is mandatory for replies.** Buttons
  + lists have interactivity; if we forget to set `context.from` on our
  outbound messages, user replies will have no parent and our state machine
  cannot continue the flow.

## 5. Open questions for the Director

1. **One Meta app per Fillthemat vs. per school.** A single shared app +
   per-school `phone_number_id` is operationally simplest but couples
   subjects (one app review breakage affects all). Director: which tenancy
   model is on the table? Likely **shared app, per-school phone_number_id**.
2. **Template library strategy.** Do we ship a Fillthemat-reusable set or
   must each school supply their own?
3. **24h window UX.** Daily cron, hourly cron, or event-driven inline send?
   What is acceptable slop between scheduled send and delivery?
4. **Contacts identity.** Today's `contacts` is **unique on (school_id,
   email)**. WhatsApp will arrive with phone but no email. Do we want a
   second unique `(school_id, phone)`? Or relax the email constraint? Or
   always require a name+phone+email at first contact?
5. **WhatsApp source of truth for landing-session.** A WhatsApp inbound
   message also needs a `landing_sessions` row for funnel
   (`chat_prepare`, `lead_captured`) and analytics. Is the phone+4321
   derived key sufficient, or do we still need a session token from a
   preceding web touch?
6. **Retention.** Web retention is `TRANSCRIPT_RETENTION_DAYS`; for WhatsApp
   transcripts, are there shorter constraint because Meta stores its own
   transcripts? Should `messages.purgeAt` apply uniformly?
7. **Dedup on inbound.** What is the canonical "this is the same prospect"
   key when (a) a phone-number reuses across two distinct local visitor
   devices, (b) the same phone sends two messages inside the 24h window?
   Most likely rule: **phone-number-based conversation identity**,
   `resumeTokenHash` removed for WhatsApp.

## Action items the Director will need for the Plan

- Parallel-table approach or merged-vendor table? Recommendation:
  **parallel** (`whatsapp_deliveries`) for opt-in phase, then merge in V2.
- Capture body plane: store `whatsapp_deliveries` columns:
  `{phone_number_id, recipient_wa_id, template_name?, template_language?,
  template_params?, body_text?, context_wamid?, window_expires_at?, kind,
  state, provider_id, provider_idempotency_key, attempts, last_error,
  next_attempt_at, claimed_at, claimed_by, sent_at, sent_count, …}`.
- Local dev noop shape: same `isLocalWhatsAppNoop()` pattern; when no
  `WHATSAPP_SYSTEM_USER_TOKEN`, log + mark `sent` + emit a synthetic
  delivered tick (cron or inline) so unit tests can see terminal state.
- Replay harness: `scripts/webhook-replay.ts whatsapp --fixture
  fixture.json --port 3030`; computes HMAC and POSTs. A single fixture
  library covers inbound text message, button reply, status, and template
  status update.
- Verify-token + app-secret columns: `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_SYSTEM_USER_TOKEN`, and per-school
  `whatsapp_phone_number_id`, `whatsapp_waba_id`.
- Add `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` to `.env.example` and
  instruct `bun run setup` to skip generating them by default (treat them
  as opt-in fidelity, like `RESEND_WEBHOOK_SECRET`).
