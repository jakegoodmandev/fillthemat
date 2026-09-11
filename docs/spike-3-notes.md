# Spike 3 — Booking & lead write paths (Worker 1: deepseek-v4-flash)

Detail of `bookSlot` and the leads flow: idempotency, contact model, email requirement, Turnstile,
landing-session requirement. Identify minimum changes for a WhatsApp-sourced booking/lead and the security
controls that must replace browser+Turnstile.

## 1. Findings

### 1.1 `POST /api/bookings` — `src/app/api/bookings/route.ts`

1. `route.ts:14-15` body-size guard (`MAX_REQUEST_BYTES 32_768`, `limits.ts:9,61-66`).
2. `route.ts:17-22` `bookingRequestSchema` (validation.ts:56-73):
   - `schoolSlug` → `slugSchema`
   - `offeringId: z.string().uuid()`
   - `slotId: z.string().min(1).max(200)`
   - `idempotencyKey: z.string().uuid()` — schema enforces **UUID format**
   - `contact: { name, email, phone }` (`contactSchema` validation.ts:52-55; email via `emailSchema` min
     3/max 254/.email, phone min 7/max 32 free text)
   - `participant: { name, age }` (`ageSchema` 0..99)
   - `turnstileToken: z.string().min(1).max(4096)` required
   - `landingSessionToken` optional 1..256
   - `conversationResumeToken` optional 1..256
3. `route.ts:23-25` `getPublicSchoolBySlug(slug)` — requires `approvedAt` AND `publishedAt` not null
   (`public.ts:57-66`). **Anonymous, unauthenticated**; access decided by school row + Turnstile.
4. `route.ts:26-30` `getRequestIp` (`request.ts:6-11`, x-forwarded-for first / x-real-ip) →
   `verifyTurnstile(token, ip)` (`turnstile.ts:5-23`): POST siteverify; missing `TURNSTILE_SECRET_KEY` →
   false → 403 `verification_failed`.
5. `route.ts:31-37` quotas BEFORE write:
   - `emailBookingQuotaExceeded(schoolId, email)` (`limits.ts:13-30`): count bookings in last 24h with same
     `contactEmailSnapshot`, cap `MAX_BOOKINGS_PER_EMAIL_PER_DAY = 6`.
   - `recipientQuotaExceeded(schoolId, email)` (`limits.ts:32-50`): count `email_deliveries` in last 24h with
     same recipient, cap `MAX_OUTBOUND_RECIPIENTS_PER_DAY = 12`.
   - both → 429 `rate_limited`.
6. `route.ts:39-47` call `bookSlot({school, offeringId, slotId, idempotencyKey, contact, participant,
   landingSessionToken, conversationResumeToken})`.
7. `route.ts:48-64` error mapping: `already_booked`→409 `acknowledged` (generic, non-disclosing);
   `ineligible`/`invalid_slot`→400; `slot_unavailable`→409. **No IP-based per-school fingerprinting** (gap
   documented: `docs/v1-plan-remaining.md:27`).
8. `route.ts:66-67` `if (!result.idempotent) await attemptPendingForBooking(booking.id)` — exactly-once
   behavior on retry; delivery triggered synchronously post-commit.
9. `route.ts:69-75` response `{bookingId, status, startAt, offeringName, participantName, idempotent}`.

### 1.2 `bookSlot` — `src/lib/schedule/book-slot.ts` (the transactional core)

- `book-slot.ts:47-49` guards: `!school.approvedAt || !school.publishedAt` → `school_not_public`.
- `book-slot.ts:51-53` `parseSlotId(slotId)` (slot-id.ts:10-31): base64url of `windowId|ISO`; validates UUID
  shape + round-trip ISO; invalid → `invalid_slot`.
- `book-slot.ts:68+` one `db.transaction`:
  1. `book-slot.ts:90-101` idempotency pre-check `(schoolId, idempotencyKey)` → return existing row
     `{idempotent: true}` — index `bookings_school_idempotency` (schema.ts:496).
  2. `book-slot.ts:103-120` offering lookup scoped `(id, schoolId, active)` + `isAgeEligible` →
     `ineligible`.
  3. `book-slot.ts:122-147` window lookup scoped `(windowId from slot, schoolId, offeringId, active)` →
     `invalid_slot`; occurrences for window loaded; `listOpenSlots` re-derives open slots against **current
     DB state** (never trusts the client's slotId beyond parse).
  4. `book-slot.ts:149-168` exact `startAt` match in open slots → else `slot_unavailable`.
  5. `book-slot.ts:170-187` contact upsert (`contacts` unique `(school_id, email)` schema.ts:291):
     `onConflictDoUpdate` updates name+phone. **Email is the identity key — NOT the phone.**
  6. `book-slot.ts:189-207` participant upsert (unique `(contact_id, normalized_name)` schema.ts:298).
  7. `book-slot.ts:209-233` occurrence materialization: `INSERT trial_occurrences ... onConflictDoNothing`
     (unique `(trialWindowId, startAt)` schema.ts:322) then `SELECT ... FOR UPDATE` (book-slot.ts:230-233).
  8. `book-slot.ts:235-260` capacity increment: `UPDATE ... SET bookedCount = bookedCount + 1 WHERE
     bookedCount < capacity` — atomic guard; no row → `slot_unavailable`.
  9. `book-slot.ts:262-302` optional provenance: `landingSessionToken` → `landingSessions` lookup by
     `(schoolId, sessionKeyHash)` (schema key `landing_sessions_school_key`); `conversationResumeToken` →
     `conversations` lookup by `(schoolId, resumeTokenHash)`; both always `hashToken`-keyed. **Missing/unknown
     tokens are silently tolerated** (booking still succeeds; FKs stay null). If conversation exists and has
     no `contactId`, it is back-filled with the contact id (book-slot.ts:293-301).
  10. `book-slot.ts:304-345` booking insert with snapshots (`participantName/Age`, `offeringName`,
      `timezone`, `startAt/endAt`, `locationSnapshot`, `instructionsSnapshot`, `contactEmail/Name/Phone
      Snapshot`), `icsUid:"pending"`, status `booked`. NotNull FKs: schoolId, contactId, participantId,
      trialOfferingId, trialWindowId, trialOccurrenceId. `conversationId`/`landingSessionId` nullable.
  11. `book-slot.ts:346-353` `bookingIcsUid(row.id)` then `UPDATE bookings SET ics_uid` (two-step because
      UID needs the row id).
  12. `book-slot.ts:354-371` two `emailDeliveries`:
      - `prospect_confirmation` → `contact.email`, key `booking-confirmation/${id}`
      - `owner_booking` → `school.notificationEmail`, key `owner-booking/${id}`
      (unique `email_deliveries_provider_key` schema.ts:545; provider idempotency keys quoted in `docs/v1-plan.md:531`).
  13. `book-slot.ts:373-382` funnel `booking_confirmed` with `metadata: { source: conversationId ? "chat" :
      "direct" }` (privacy-safe filtered, funnel.ts:23-44).
- Unique-violation recovery (`book-slot.ts:384-413`): on 23505, constraint name `idempotency` → re-select →
  idempotent success; `active_participant_occurrence` (partial unique index schema.ts:497-499, WHERE status
  <> 'cancelled') → `already_booked`. Other unique errors rethrow.
- `cancelBooking` (`book-slot.ts:416-540`) is transactional + replay-safe: `FOR UPDATE`, cancels only when
  `status==="booked" && startAt > now`, emits `booking_cancellation`/`owner_cancellation` deliveries with
  sequence bumps, decrements occupancy. Cancellation has NO Turnstile or quota (dashboard-only path today).

### 1.3 `POST /api/leads` — `src/app/api/leads/route.ts`

1. `leadRequestSchema` (validation.ts:75-83): `schoolSlug`, `contact{name,email,phone}`, optional
   `participantName`/`participantAge`/`offeringId`/`statedNeed`, required `turnstileToken`,
   optional `landingSessionToken`.
2. `leads/route.ts:22-29` public school lookup; `leads/route.ts:33-36` `verifyTurnstile`.
3. `leads/route.ts:37-40` `recipientQuotaExceeded(school.id, school.notificationEmail)` — the **school's**
   notification email recipient cap (owner-lead emails), 429.
4. `leads/route.ts:44-118` transaction:
   - `leads/route.ts:46-63` contact upsert (same `(school_id, email)` conflict target).
   - `leads/route.ts:65-83` **landing session is REQUIRED**: resolve `landingSessionToken` by
     `sessionKeyHash`; if absent or `session.schoolId !== school.id` →
     `throw "session_required"` (`leads/route.ts:74-82`). **No landing session token → the whole request
     fails with a 500** (the throw is not mapped to a stable 400 — gap at `docs/v1-plan-remaining.md:31`).
   - `leads/route.ts:85-100` insert `leads` `{schoolId, landingSessionId NOT NULL FK, contactId, ...,
     status:"open"}`.
   - `leads/route.ts:102-109` `email_deliveries` `owner_lead` recipient `school.notificationEmail`, key
     `owner-lead/${id}`.
   - `leads/route.ts:111-116` funnel `lead_captured` with `{hasOffering}`.
5. `leads/route.ts:118` `attemptPendingForLead(lead.id)` post-commit.

### 1.4 Idempotency key issuance — `src/app/api/bookings/key/route.ts`

```ts
export async function POST() { return Response.json({ idempotencyKey: randomUUID() }); }
```
Server-issued UUID via an **unauthenticated** endpoint (browser calls it right before POST /api/bookings,
`booking-confirmation-form.tsx:37-40`). There is no server-side binding of the key to a session before the
booking insert — the DB unique `(school_id, idempotency_key)` is the backstop, and replay returns the stored
booking. `docs/v1-plan.md:318` calls for "Unique server-issued `idempotency_key` within the school."

### 1.5 Contact model friction (schema.ts:281-306)

- `contacts.email text NOT NULL`, unique `(school_id, email)`; `name NOT NULL`, `phone NOT NULL`.
- All downstream leaders are keyed off contact.id; bookings snapshot `contactEmailSnapshot NOT NULL`.
- **A WhatsApp contact with no email cannot exist in `contacts` today.** The phone is a free-text string
  (no E.164 validation; `phoneSchema` min 7 max 32).
- Leads additionally require `leads.landingSessionId NOT NULL` (schema.ts:409, FK restrict — schema.ts:425-427).

## 2. Evidence (quoted)

- Idempotent replay, `book-slot.ts:90-101`:
  ```ts
  const existing = await tx.select().from(bookings)
    .where(and(eq(bookings.schoolId, input.school.id),
               eq(bookings.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing[0]) { return { row: existing[0], idempotent: true }; }
  ```
- Occupancy atomics, `book-slot.ts:242-258`:
  ```ts
  const [incremented] = await tx.update(trialOccurrences)
    .set({ bookedCount: sql`${trialOccurrences.bookedCount} + 1`, updatedAt: new Date() })
    .where(and(eq(trialOccurrences.id, occurrence.id),
               sql`${trialOccurrences.bookedCount} < ${trialOccurrences.capacity}`))
    .returning();
  if (!incremented) { throw Object.assign(new Error("slot_unavailable"), { code: "slot_unavailable" }); }
  ```
- Contact identity by email, `book-slot.ts:174-186`:
  ```ts
  .insert(contacts).values({ schoolId, email, name, phone })
  .onConflictDoUpdate({ target: [contacts.schoolId, contacts.email], set: { name, phone, updatedAt } })
  ```
- Turnstile hard-fails when unconfigured, `turnstile.ts:5-10`:
  ```ts
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  ```
- Lead requires session, `leads/route.ts:74-82`:
  ```ts
  if (!landingSessionId) {
    throw Object.assign(new Error("session_required"), { code: "session_required" });
  }
  ```
- Quotas, `limits.ts:5-6`: `MAX_BOOKINGS_PER_EMAIL_PER_DAY = 6`, `MAX_OUTBOUND_RECIPIENTS_PER_DAY = 12`.
- Booking schema enforces UUID idempotency keys, `validation.ts:67`: `idempotencyKey: z.string().uuid()`,
  and required turnstile `validation.ts:70`: `turnstileToken: z.string().min(1).max(4096)`.
- Post-commit delivery fire, `bookings/route.ts:66`: `await attemptPendingForBooking(result.booking.id);`
  and `leads/route.ts:118`: `await attemptPendingForLead(lead.id);`

## 3. Contradictions / lacunae

- **Turnstile is present on web but the platform itself has no "authenticated write" channel.** There is no
  server-side session-bound CSRF or per-IP fingerprint; trust rests on Turnstile + quotas + idempotency.
  WhatsApp replaces this with Meta's webhook signature (`X-Hub-Signature-256` / app secret) — the analog
  already exists in `resend` webhook verification (`webhooks/resend/route.ts:5-9` + `MAX_BODY_BYTES 64_000`).
- `emailDeliveries` is email-shaped: it carries `recipient` email, provider idempotency key, and is rendered
  by `sendDelivery` → Resend (`deliveries.ts:63-147`). Using it for WhatsApp would conflate channels and
  trigger `isLocalEmailNoop` logic; a parallel `message_deliveries`/wa outbox table (or enum extension for
  `email_kind`) is a schema decision. `email_kind` is a Drizzle enum (schema.ts:14-24) — adding kinds = migration.
- Quotas are **email-recipient-counted**, not wa_id-counted; WhatsApp abuse controls need wa_id/phone keying.
- `idempotencyKey` UUID format: Meta's inbound message id (`wamid...`) is not a UUID; a WhatsApp adapter must
  map `wamid` → uuid (e.g. hash) or relax `bookingRequestSchema`.
- `booking-confirmation-form.tsx:37-40` issues the idempotency key over a public endpoint with no binding —
  fine for the web, but a WhatsApp adapter must decide who mints it (platform server).
- Booking/lead error contracts deliberately generic (`acknowledged`, `already_booked`); policy documented at
  `docs/v1-plan.md:519` and `docs/v1-plan.md:748` ("Immediate anonymous booking remains possible after
  Turnstile and quotas; residual determined fake-identity risk is accepted").
- Email is structurally required everywhere on the write path: `contact.email NOT NULL`, snapshots, and Resend
  confirmation emails. WhatsApp path needs "email optional" (open product question (b)).

## 4. Risks & gotchas

- **Email-required**: minimum change for WhatsApp = new nullable `whatsapp_phone`/allow email-less contact +
  snapshot policy, plus decide confirmation delivery (WhatsApp template msg vs email when absent).
- **Publication gate**: `bookSlot` and leads both require approved+published school; WhatsApp should only
  serve published schools (no preview concept).
- **Idempotency semantics**: web = client-minted UUID per submit; WhatsApp webhook retries (Meta redelivers
  with same `wamid`) must map to the same booking; decision: use hashed `wamid` as `idempotencyKey` (stable)
  vs a fresh key + message-id dedupe table. The existing `(school_id, idempotency_key)` unique handles
  duplicates only if the key is stable.
- **Session requirement for leads** (`leads.landingSessionId NOT NULL`): WhatsApp has no browser session.
  Either synthesize a per-wa conversation "session" row, relax the FK (nullable), or gate leads behind the
  conversation id. Least-surprise option: reuse `conversations` as "session" for WhatsApp channel.
- **Rate limits**: same-school bots via WhatsApp (a single wa_id hammers) need per-wa_id caps; the current
  email-based caps don't translate (a wa user may have no email).
- **Post-commit email firing**: `attemptPendingForBooking` runs inside the request; under a webhook
  that pattern is fine (fast ack) but `sendDelivery` may throw → ensure the webhook still acks 200.
- Turnstile config absent → hard 403 on web (`turnstile.ts:7-8`); dev uses Cloudflare always-pass test keys
  (`docs/local-development.md` Phase 1). For WhatsApp, Turnstile is **not applicable** — replaced by Meta
  signature + wa_id identity + quotas.
- `MAX_OUTBOUND_RECIPIENTS_PER_DAY = 12` counts confirmation + owner emails; adding WhatsApp outbound sends
  into the same counter would exhaust it quickly (24h window sends should be separate spend).

## 5. Open questions to escalate (director)

1. **Booking write path**: does the platform create bookings from WhatsApp (agent collects participant +
   contact + chosen slot, server calls `bookSlot` with platform-minted idempotency key and hashed `wamid`),
   or does WhatsApp qualify and deep-link to `/s/<slug>` for the final form? (Product decision (a).)
2. **Contacts without email**: allow nullable email + `whatsapp_phone` unique key on contacts; what happens
   to `prospect_confirmation` email if no email? WhatsApp template message is the natural fallback.
3. **Leads/session semantics** on WhatsApp: treat each wa conversation as a pseudo landing session, or relax
   `leads.landingSessionId`; ownership/attribution (`source: "chat"`) needs a channel dimension.
4. **Tenancy**: per-school phone_number_id → school mapping; does one WABA per school or per-region suffice
   (decision (c))? This determines whether `schoolId` derivation from webhook metadata is 1:1.
5. **Abuse model replacement**: define per-wa_id/day caps + shared platform-wide send budget distinct from
   email `MAX_OUTBOUND_RECIPIENTS_PER_DAY`.
6. **Who mints idempotency keys over WhatsApp** and where the durability boundary sits (webhook ack vs enqueue).
7. Keep `cancelBooking` off WhatsApp for launch (email-only path) — confirm no WhatsApp cancellation in v1.