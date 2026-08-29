# V1 remaining vs `docs/v1-plan.md`

Snapshot of **current `v1` code** versus the complete V1 architecture. This is not a deploy guide (see `docs/v1-deploy-current.md`). Product non-goals in the plan (payments, SMS, GCal OAuth, tenant domains, waivers, RAG, staff roles, ads, post-trial sequences) stay out of scope.

## What already matches the plan

- One Next.js 16 App Router app, Bun, Drizzle `app` schema, local Supabase Auth (Google only).
- Owner: Google sign-in, one school, onboarding, settings, preview, publish, bookings, leads.
- Prospect: `/s/[slug]` chat + Book Trial, same confirmation form, Turnstile, atomic booking, no-match lead.
- Recurrence/slots (including DST fixtures), ICS, Resend deliveries, reminder rule, cancel, Showed / No-show.
- Maintenance cron route, Resend webhook route, funnel session qualification.

Founder-alpha mechanics have been exercised locally (Google login, Tribu configure/preview/publish, chat, booking).

## Gaps

### Product UI and owner UX

- **shadcn / Radix and AI SDK Elements were never installed.** Owner and public UI is hand-rolled Tailwind. Plan specified shadcn components plus `https://elements.ai-sdk.dev/api/registry/all.json`.
- **Dark owner / scoped light public theming** is only partial (public layout forces a white page; school accent CSS variable is set but barely used).
- **Cancellation confirmation** is a plain button, not an alert-dialog.
- **No internal school-approval UI.** Plan allows Studio for founder alpha; an operator surface is still unbuilt for anyone else.
- **Chat refresh recovery** is incomplete: GET `/api/chat` exists, but `useChat` does not hydrate canonical history on reload.
- **Direct vs chat conversion split** on the dashboard is approximate (chat-assisted count from funnel metadata, not a full dual-path report).

### Booking, quotas, and abuse

- **Per-school/IP quota** is not stored or enforced. Email/recipient daily caps exist; IP fingerprinting on successful reservations does not.
- **`already_booked` disclosure:** concurrent same-participant conflict returns a generic `acknowledged` payload, but status codes/body are not fully aligned with “generic acknowledgement, never disclose a third party’s booking.”
- **Request-body / WAF policy** is application-side only. Vercel WAF is not configured on `/api/chat`, `/api/bookings`, `/api/leads`, `/api/sessions`.
- **Lead capture requires a landing session.** Missing session throws rather than always returning a stable 400.
- **Owner preview vs public APIs** was patched so unpublished owner preview can chat/list slots. Prospect booking/leads still require approved+published. Worth a regression pass.

### AI concierge

- **Default model `anthropic/claude-sonnet-4.6` is not available on Gateway free tier.** Runtime must set `BOOKING_AGENT_MODEL` to an allowed model, or the team needs paid Gateway credits. Plan fallback GPT-5.4 is not wired as a manual switch in the UI.
- **Gateway `tags` / `user` are set;** Zero Data Retention is not verified in code or project settings.
- **Privacy-safe chat telemetry** (model, TTFT, usage, step count, finish/abort, tool name/result code — no prompts/PII) is not persisted.
- **Hard limits** are incomplete vs plan: conversation message cap and user-char cap exist; per-school daily request/token ceiling and project spend ceiling in-app do not (a $25/month Gateway budget was set on the Vercel project only).
- **Concurrent generation lock** exists (`generatingAt`); disconnect/`onEnd` persistence is implemented but not integration-tested. Abort/error completion paths are lightly covered.

### Email and maintenance

- **Founder-alpha From address** (`onboarding@resend.dev`) cannot send to arbitrary prospects. Pilot requires a verified Fillthemat sending domain and production `RESEND_FROM`.
- **Resend webhook** is implemented but not registered against a hosted endpoint with `RESEND_WEBHOOK_SECRET`.
- **Cron** is declared in `vercel.ts` as `0 14 * * *`. Overlapping-claim behavior is coded (`FOR UPDATE SKIP LOCKED`) but not tested. Pilot wants `*/5 * * * *` on Pro.
- **Heartbeat alerting** (no successful run in interval, nonzero bounce/complaint) is not built. Dashboard shows last run and failure count only.

### Data, migrations, recovery

- **Baseline Drizzle migration is committed** (`drizzle/0000_*.sql`) including `app` schema, `auth.users` FK, revoke on Data API roles, published slug/timezone trigger.
- **No hosted preview/production Supabase** and no migrate-against-preview rehearsal.
- **No backup/PITR restore drill.**
- **Transcript 30-day purge** is in the maintenance worker; deletion/export procedure and log redaction policy are undocumented/unverified.
- **`drizzle-kit push` vs migrate:** local used `migrate`. Fine. Do not push against hosted data.

### Verification the plan still requires

Unit coverage exists for recurrence/DST, ICS, slug, site URL, reminder window, prompt boundary, privacy-safe metadata.

Still missing:

- **Database integration tests** (`bun run test:integration`): concurrent identical bookings, idempotency replay, two participants one occurrence, ineligible reject, capacity, transaction rollback, double cancel, capacity floor, slug/timezone immutability, cross-school isolation, overlapping maintenance claims, short-lead reminder fixtures.
- **Playwright** beyond `e2e/smoke.spec.ts` (home heading): publish visibility, direct booking, chat-prepared form, no-match lead, confirmation retry, refresh recovery, generic duplicate behavior.
- **CI** with local Supabase and “assert email rows, do not call Resend.”
- **Full founder-alpha smoke checklist** items not yet proven in one sitting: ICS validity, sibling booking, duplicate retry occupancy, exhaust capacity → lead, double cancel, maintenance twice, unpublished 404, signed-out dashboard redirect.

### Pilot launch gate (entirely remaining)

Isolated hosted Supabase (preview vs production), exact Google OAuth origins/callbacks/consent branding, stable hostname, verified Resend domain, Bun 1.4 preview smoke (AI stream, OAuth, Supavisor, cron, webhooks), WAF + Turnstile in production, Gateway ZDR + spend ceiling verification, backup restore drill, maintenance/email alerts, transcript notice + purge + export, second-tenant isolation smoke.

## Intentional non-goals (do not treat as remaining V1 work)

Post-trial conversion, payments, SMS, Google Calendar API, tenant custom domains, waiver e-sign, RAG/PDFs, ad management, waitlists, staff roles, RLS on `app.*`, Supabase Data API for application data.
