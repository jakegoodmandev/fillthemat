# Phase 6 — WhatsApp production rollout (human-only)

**Do not paste this into a Director implementation session.** Phases 1–5 are the code. Phase 6 is
Meta + Vercel + one pilot school. A Director sub-agent cannot register a Meta app, submit templates,
or complete App Review.

After [PR #38](https://github.com/jakegoodmandev/fillthemat/pull/38) (Phase 5) is merged and migrated,
the product path is live in stub mode. This document is the operator runbook.

Source of truth: `docs/whatsapp-plan.md` §3 Phase 6, §5 production checklist, decisions **C / D / G /
D10 / D11**, plus `docs/spike-supabase-cron.md` (Hobby-safe daily cron; do not add a sub-daily Vercel
cron on Hobby).

---

## 0. What is already shipped (do not re-derive)

| Phase | In tree |
| --- | --- |
| 1 | `whatsapp_deliveries`, nullable `contacts.email` + unique `(school_id, phone)`, `schools.whatsapp_phone_number_id` / `whatsapp_waba_id`, `isLocalWhatsAppNoop()` |
| 2 | `/api/webhooks/whatsapp` GET verify + POST `X-Hub-Signature-256`, wamid dedupe, replay CLI |
| 3 | `conversations.wa_id_hash`, inbound UIMessage parts, `generatingAt` |
| 4 | `whatsapp_jobs` worker, Graph client + noop, 24h window + template fallback, `after()` wake, typing indicator, daily cron `0 5 * * *` |
| 5 | intents + confirmation buttons, shared `create-lead`, `bookSlot` no-email + WA template confirmation, per-`wa_id` caps |

**Toggle today:** a school is WhatsApp-routable iff `schools.whatsapp_phone_number_id` is set (unique
when non-null). Local seed uses `LOCAL_WHATSAPP_PHONE_NUMBER_ID`. There is **no dashboard UI** for
these columns and **no extra boolean flag**. D10's "per-school toggle" is: set or clear
`whatsapp_phone_number_id` (and `whatsapp_waba_id`) on the pilot row. If you want an owner-facing
settings form, that is a **separate, optional, small Director task** — not Phase 6.

---

## 1. Preconditions (code)

1. Merge Phase 5. Apply Drizzle migration `0006` (intents table + nullable `bookings.contact_email_snapshot`).
2. Confirm production/staging has the Hobby-safe cron only: `vercel.ts` → `/api/cron/whatsapp` at `0 5 * * *`.
   D11: do **not** add a 1-minute / 5-minute cron unless you are on Pro **and** the pilot proves need.
3. Confirm `WHATSAPP_API_VERSION` default (`src/lib/whatsapp/config.ts`, currently `v26.0`) is still a
   live Graph version. Meta EOLs versions. If it is dead, bump the default **and** the Vercel env together.
4. Template **names and body variable counts** in `src/lib/whatsapp/templates.ts` must match Meta
   exactly (`en_US`):

   | name | body params (order) |
   | --- | --- |
   | `booking_confirmation` | school, participant, offering, when |
   | `booking_reminder` | school, participant, when |
   | `lead_confirmation` | school |

   Local render strings in that file are **not** what Meta stores. You submit real copy in Business
   Manager; Graph send only passes the name + ordered body params.

5. Optional deploy-time check (not required locally): `after()` / `waitUntil` actually runs on the
   Vercel runtime you ship. Daily cron is the safety net if it does not.

---

## 2. Env (Vercel — never `bun run setup`)

Five keys (`.env.example`). Local stays blank → stub.

```
WHATSAPP_APP_SECRET            # Meta App Secret; HMAC for X-Hub-Signature-256. NOT the verify token.
WHATSAPP_VERIFY_TOKEN          # you invent this string; Meta GET handshake must match.
WHATSAPP_SYSTEM_USER_TOKEN     # permanent System User token (see §3.4)
WHATSAPP_API_VERSION           # e.g. v26.0 if still live; else the current Graph version
WHATSAPP_GRAPH_BASE            # optional; default https://graph.facebook.com
```

Set them on the **staging** Vercel project first, then production. Do not put real tokens in
`.env.local` on a worktree unless you are deliberately leaving stub mode.

Also required and already used by the app: `CRON_SECRET` (cron routes), `NEXT_PUBLIC_SITE_URL`
(must be the HTTPS origin Meta will call).

---

## 3. Meta setup (order of operations)

Follow this order. Use cases cannot be removed once added.

### 3.1 Meta app

1. [developers.facebook.com/apps/creation/](https://developers.facebook.com/apps/creation/)
2. Name + contact email.
3. Use case: **"Connect with customers through WhatsApp"**.

### 3.2 Business portfolio

Connect a business portfolio. Complete business verification if Meta requires it for the products
you actually use (WABA + system user + templates).

### 3.3 WABA + phone number (decision C)

One **shared** Fillthemat Meta app + WABA. Per-school Cloud API `phone_number_id`.

In WhatsApp → API Setup:

1. Connect or create the WhatsApp Business Account. Record **WABA ID**.
2. Add the **pilot school's** business phone number. Record **`phone_number_id`**.
3. Write those onto the pilot `schools` row (`whatsapp_waba_id`, `whatsapp_phone_number_id`).
   Until that row is set, inbound webhooks for that number resolve to unknown-phone and fail closed.

Do **not** create per-school WABAs or Embedded Signup in v1 (plan non-goals).

### 3.4 System User + permanent token

Business Settings → System users:

1. Create an **admin** system user.
2. Assign assets: app (Manage app, Full control); WhatsApp account (Manage WhatsApp Business
   accounts, Full control).
3. Generate a token with:
   - `business_management`
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Store it as `WHATSAPP_SYSTEM_USER_TOKEN` on Vercel. Treat it as a production secret.

### 3.5 Utility templates (decision G)

Submit **Fillthemat-owned** shared templates, language `en_US`, names **identical** to the registry
above. Approvals gate **out-of-window** sends (and Phase 5's no-email booking confirmation, which
always uses `booking_confirmation`).

Submit at least:

- `booking_confirmation` (4 body vars)
- `booking_reminder` (3 body vars)
- `lead_confirmation` (1 body var)

Wait for **APPROVED** before testing out-of-window or relying on no-email confirmation in prod.
In-window free-form text still works without templates.

### 3.6 Webhook

Callback URL: `https://<NEXT_PUBLIC_SITE_URL>/api/webhooks/whatsapp`

- GET verify: `hub.mode=subscribe` + `hub.verify_token === WHATSAPP_VERIFY_TOKEN` → 200 `text/plain`
  challenge (already implemented).
- Subscribe fields: `messages` and `message_template_status_update`.
- App secret = `WHATSAPP_APP_SECRET` (HMAC). Must differ from the verify token.

Meta must be able to reach this URL from the public internet. Staging Vercel origin first.

### 3.7 App Review

Required only if people **without a role** on the app/business will message the number. Budget this
before a public (non-tester) rollout. Testers/roles can exercise the number before Review.

---

## 4. Pilot school enablement (decision D / D10)

Ship order is **leads first, bookings second**, **one** approved + published school.

1. School is `approvedAt` + `publishedAt` (same public gate as `/s/<slug>`).
2. Set `whatsapp_phone_number_id` + `whatsapp_waba_id` on that row only.
3. Leave every other school null → they never match inbound `metadata.phone_number_id`.
4. Do **not** enable a second school until the acceptance bar below is green.

v1: **no WhatsApp cancellation** (decision K). Point the pilot owner at the dashboard/email cancel
path.

---

## 5. Acceptance bar (real Meta — not replay)

All of these on **staging**, then the same on **production** with the pilot number.

1. **Two-way in-window:** send a text from a test phone (app role / tester) → webhook 200, job
   processed, reply arrives in WhatsApp. Typing indicator optional-nice.
2. **Statuses:** outbound `whatsapp_deliveries` moves `sent` → `delivered` (and `read` if the client
   sends it). Failed Graph sends surface `last_error`, not a silent pending.
3. **Lead path first:** consent → `leads` row, synthesized landing session `utm_source='whatsapp'`,
   contact upsert on `(school_id, phone)` if no email, `lead_captured` with `{channel:'whatsapp'}`,
   owner email still fires.
4. **Booking path second:** `prepare_booking` → interactive confirm → `bookings` row, occupancy +1,
   no double-write on Meta retry of the same wamid. No-email contact → `booking_confirmation`
   template enqueued (needs the template APPROVED, or stay inside 24h and still assert the row).
5. **Out-of-window template:** after 24h with no inbound (or force-closed window in a controlled
   test), a template send succeeds once approved.
6. **Caps:** do not load-test a real number into the daily cap; the integration tests already cover
   429-equivalent. Spot-check that prod logging would show the notice path.

Only then: production env + production webhook + production school row → **publish** (school already
published; "publish" here means the WhatsApp number is the live customer channel). Second school is
a later ops step: another `phone_number_id` on another row, same WABA.

---

## 6. Monitoring (minimum)

No new product surface required for v1. Watch:

- `whatsapp_jobs` stuck `claimed` / `failed` (daily cron recovers stale claims).
- `whatsapp_deliveries` `failed` spikes; 24h-window error `131030` should fall back to template, not
  sit in failed if the template is approved.
- Cron: `/api/cron/whatsapp` at 05:00 UTC; `cron_runs` / logs for that route.
- Wamid uniqueness: duplicate Meta deliveries must no-op.
- Per-`wa_id` caps in `src/lib/security/limits.ts` (`MAX_BOOKINGS_PER_WA_ID_PER_DAY`,
  `MAX_WHATSAPP_OUTBOUND_PER_WA_ID_PER_DAY`) — distinct from email recipient quota.

Alerting: start with Vercel logs + a query on `failed` counts. Fancy dashboards are out of scope.

---

## 7. Explicit non-goals (still)

- No Director re-implementation of Phases 1–5.
- No sub-daily Vercel cron on Hobby (D11 deferred).
- No `cancelBooking` over WhatsApp.
- No per-school WABAs, Embedded Signup, groups, calling.
- No email/OAuth changes.
- Do not put production `WHATSAPP_*` in worktree `.env.local` as a matter of course.

---

## 8. Optional follow-ups (only if you want code)

These are **not** Phase 6. Each is a small, separate Director plan if you choose:

1. **Dashboard WhatsApp settings** — owner (or you) can set/clear `whatsapp_phone_number_id` /
   `whatsapp_waba_id` without SQL. Closest match to D10's "dashboard flag".
2. **Graph version bump** — if `v26.0` is EOL at rollout.
3. **Pro-plan retry cron** — only after the pilot shows the daily sweeper is too slow (D11).
4. **Failed-delivery alerting** — Resend-style webhook already exists for email; WhatsApp is logs +
   table until you add something.

---

## 9. Operator checklist (copy/paste)

```
[ ] Phase 5 merged; migration 0006 applied on staging then prod
[ ] Graph version still live; WHATSAPP_API_VERSION set to match
[ ] Meta app + WhatsApp use case
[ ] Business portfolio (+ verification if required)
[ ] WABA + pilot phone_number_id recorded
[ ] System User token on Vercel (staging)
[ ] Templates submitted; booking_confirmation APPROVED before no-email / out-of-window
[ ] Webhook URL + verify token + app secret; fields messages + message_template_status_update
[ ] Staging: two-way in-window message
[ ] Staging: delivery statuses
[ ] Staging: lead on WhatsApp
[ ] Staging: booking on WhatsApp (then out-of-window template)
[ ] Pilot school row: approved+published + whatsapp_* columns set; all other schools null
[ ] Same env + webhook on production
[ ] Production smoke on a tester number
[ ] App Review if non-role users will write in
[ ] Second school: later, new phone_number_id only
```
