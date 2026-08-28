# Fillthemat MVP architecture

## Context

Greenfield repo (`README.md`, `LICENSE`, `.gitignore` only). `.gitignore` already assumes Next.js + Vercel. Build a dogfoodable multi-tenant MVP: a martial-arts school owner signs up, configures one academy, publishes a branded chat landing page, and a prospect books a trial class through that chat. After booking, the prospect gets a confirmation email with a `.ics` calendar file and one reminder email ~24h before class. The owner sees bookings and marks Showed / No-show. Stop there — attendance is a status field only; no post-trial sequences, ads, payments, SMS, Google Calendar OAuth, custom domains, or RAG.

Chosen product mechanics: recurring weekly trial windows with instant book; email + `.ics` + daily reminder cron; Clerk signup + create-school onboarding.

## Approach

### 1. Scaffold the Next.js app, then provision Vercel resources

Do not invent a monorepo, next-forge, Eve, or Workflow DevKit. One Next.js App Router app.

1. From repo root, non-interactive scaffold into the existing directory (keep `README.md` / `LICENSE`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm --yes
```

If the CLI refuses a non-empty directory, pass the flag it prints (often `--force`) rather than deleting README/LICENSE.

2. Add `"ai"` and `"@ai-sdk/react"` only after scaffold. Do not add `@ai-sdk/openai` / `@ai-sdk/anthropic` or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Models are plain `"provider/model"` strings through AI Gateway.

3. Link and provision **before** `db:push` or `npm run dev`:

```bash
vercel --version && vercel whoami
vercel link --yes --scope <team> --project fillthemat
vercel integration add neon --yes --no-claim
vercel integration add clerk --yes --no-claim
vercel integration discover --category messaging
vercel integration add <top-email-integration> --yes --no-claim
```

Messaging: prefer **Resend** if it appears in discover results; otherwise take the top email provider from that list. If `add` is connectable (opens a browser), stop and have the user finish claim, then continue. After each integration: `vercel env pull .env.local --yes`.

4. Enable AI Gateway on the linked Vercel project (dashboard → project → AI Gateway). `vercel env pull .env.local --yes` must produce `VERCEL_OIDC_TOKEN`. Do not set `AI_GATEWAY_API_KEY` unless OIDC pull fails.

5. Add any keys integrations did not provision. Names only in `.env.example`; values only via `vercel env add` then re-pull:

```
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
RESEND_FROM
CRON_SECRET
```

`NEXT_PUBLIC_APP_URL` local = `http://localhost:3000`. `RESEND_FROM` local/onboarding = `Fillthemat <beth.t@example.com>` until a domain is verified. Generate `CRON_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` piped into `vercel env add CRON_SECRET development preview production` without echoing it.

6. Commit `.env.example` with empty values for those names. Never commit `.env.local`.

If Neon/Clerk Marketplace add fails: provision in the Vercel dashboard, re-pull env, continue. If Resend is unavailable: create a Resend API key, `vercel env add RESEND_API_KEY`, still use the `resend` npm package — do not mock email.

### 2. Database: Neon HTTP + Drizzle, occupancy row for capacity

Install: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `dotenv-cli` (dev).

Use **`drizzle-orm/neon-http`** (not WebSocket `Pool`, not Prisma, not a `Proxy` wrapper). Lazy client so `next build` does not throw when `DATABASE_URL` is missing:

`src/db/index.ts` — `getDb()` as in the Vercel storage skill (plain `let _db`, `createDb()` with `neon(process.env.DATABASE_URL!)` + `drizzle(sql, { schema })`).

`drizzle.config.ts`: `schema: "./src/db/schema.ts"`, `dialect: "postgresql"`, `dbCredentials.url: process.env.DATABASE_URL!`.

`package.json` scripts (dotenv required; drizzle-kit does not load `.env.local`):

```json
"db:push": "dotenv -e .env.local -- drizzle-kit push",
"db:studio": "dotenv -e .env.local -- drizzle-kit studio"
```

Do not add migration files for MVP; `db:push` is the schema path. If `push` is rejected on a later production branch, then `drizzle-kit generate` + migrate — not now.

`src/db/schema.ts` — PostgreSQL via `drizzle-orm/pg-core`. All ids `uuid` with `defaultRandom()`. Timestamps `timestamptz` not null default now. Exact tables and columns:

**`users`**
- `id` uuid pk
- `clerkUserId` text not null unique
- `email` text not null
- `name` text
- `createdAt` timestamptz

**`schools`** — one school per owner (`ownerUserId` unique)
- `id` uuid pk
- `ownerUserId` uuid not null unique → `users.id`
- `slug` text not null unique
- `name` text not null
- `timezone` text not null (IANA, e.g. `America/Los_Angeles`)
- `phone` text
- `website` text
- `addressLine1` text
- `city` text
- `region` text
- `postalCode` text
- `country` text not null default `'US'`
- `parkingNotes` text
- `accessNotes` text
- `whatToWear` text
- `arriveEarlyMinutes` integer
- `waiverNotes` text
- `whatToExpect` text
- `membershipsAndPricing` text
- `agentInstructions` text
- `welcomeMessage` text
- `logoUrl` text (URL string only; no Blob upload)
- `primaryColor` text not null default `'#1d4ed8'`
- `createdAt`, `updatedAt` timestamptz

**`faqs`**
- `id` uuid pk
- `schoolId` uuid not null → `schools.id` on delete cascade
- `question` text not null
- `answer` text not null
- `sortOrder` integer not null default 0

**`trialWindows`** (`trial_windows`)
- `id` uuid pk
- `schoolId` uuid not null → `schools.id` on delete cascade
- `dayOfWeek` integer not null (0 = Sunday … 6 = Saturday, JS `getDay`)
- `startMinute` integer not null (minutes from local midnight, 0–1439)
- `durationMinutes` integer not null default 60
- `capacity` integer not null default 8
- `label` text not null default `'Intro class'`
- `active` boolean not null default true

**`trialOccurrences`** (`trial_occurrences`) — dated instance, created lazily on first successful book
- `id` uuid pk
- `trialWindowId` uuid not null → `trial_windows.id`
- `schoolId` uuid not null → `schools.id`
- `startAt` timestamptz not null
- `capacity` integer not null
- `bookedCount` integer not null default 0
- unique `(trialWindowId, startAt)`
- check `booked_count >= 0 AND booked_count <= capacity`

**`prospects`**
- `id` uuid pk
- `schoolId` uuid not null → `schools.id`
- `name` text not null
- `email` text not null
- `phone` text not null
- `createdAt` timestamptz
- index `(schoolId, email)`

**`conversations`**
- `id` uuid pk
- `schoolId` uuid not null
- `prospectId` uuid nullable → `prospects.id`
- `createdAt` timestamptz

**`messages`**
- `id` uuid pk
- `conversationId` uuid not null → `conversations.id` on delete cascade
- `role` text not null (`user` | `assistant`)
- `parts` jsonb not null (AI SDK `UIMessage.parts`)
- `createdAt` timestamptz

**`bookings`**
- `id` uuid pk
- `schoolId` uuid not null
- `prospectId` uuid not null → `prospects.id`
- `conversationId` uuid nullable
- `trialOccurrenceId` uuid not null → `trial_occurrences.id`
- `trialWindowId` uuid not null
- `startAt` timestamptz not null
- `endAt` timestamptz not null
- `status` text not null default `'booked'` — allowed: `booked` | `showed` | `no_show` (no cancel in MVP)
- `confirmationEmailSentAt` timestamptz nullable
- `reminderEmailSentAt` timestamptz nullable
- `icsUid` text not null
- `createdAt` timestamptz
- index `(schoolId, startAt)`

No `school_members`, no waitlist, no UTM table. `schoolId` on every tenant row is the expansion seam for staff roles later.

Run `npm run db:push` only after `.env.local` has `DATABASE_URL`.

### 3. Auth: Clerk v7, protect layouts not the public LP

Install `@clerk/nextjs`. Wrap the app with `ClerkProvider` **inside** `<body>` (not wrapping `<html>`). Pages:

- `src/app/sign-in/[[...sign-in]]/page.tsx` — `<SignIn />`
- `src/app/sign-up/[[...sign-up]]/page.tsx` — `<SignUp />`

Next.js 16: put Clerk session plumbing in `src/proxy.ts` (not `src/middleware.ts` unless the installed Clerk version errors on `proxy.ts`; if it errors, use `src/middleware.ts` with the same `clerkMiddleware` body). Export Clerk’s `clerkMiddleware` as the file’s required export (`proxy` on Next 16). Matcher = Clerk’s default static-file skip. **Do not** `auth.protect()` for `/api(.*)` in this matcher — `/api/chat` and `/api/cron/reminders` are public.

Real gates (defense in depth; proxy is not the sole auth layer):

- `src/app/dashboard/layout.tsx` and `src/app/onboarding/layout.tsx`: `const { userId } = await auth(); if (!userId) await auth.protect()`.
- Dashboard layout: load school for this Clerk user; if none, `redirect("/onboarding")`.
- Onboarding page: if school already exists, `redirect("/dashboard")`.

`src/lib/auth/current-user.ts` — `ensureUser()`: `currentUser()` / `auth()`, upsert `users` on `clerkUserId` with email + name, return the row. Call this from onboarding create and dashboard layout.

`src/lib/auth/current-school.ts` — `getOwnedSchool()`: `ensureUser()` then `schools` where `ownerUserId = user.id`. Return `null` if missing.

Public `/s/[slug]` and `/` do not require sign-in.

### 4. Owner onboarding and dashboard

shadcn first, after env works:

```bash
npx shadcn@latest init -d --base radix
npx shadcn@latest add button card input label textarea select switch tabs dialog alert-dialog sheet dropdown-menu badge separator skeleton table
```

Fix Geist circular font in `globals.css` (`--font-sans: "Geist", ...` literals) and put font variable classes on `<html>`. Default product chrome is **dark** via a `className="dark min-h-svh bg-background text-foreground"` wrapper on dashboard + sign-in + `/`. Do **not** set `dark` on `<html>` — the public LP must stay on `:root` light tokens.

Dashboard nav (simple header, not a marketing site): Settings, Bookings, copy-public-link control. `UserButton` from Clerk.

**`/`** — if signed in, redirect to `/dashboard` or `/onboarding`; if signed out, academy-agnostic stub: product name + Sign in / Sign up.

**`/onboarding`** — one card form, Server Action `createSchool`:
- `name` required
- `slug` required, unique, auto-filled from name via `slugify` (`src/lib/slug.ts`: lowercase, `[a-z0-9]+` joined by hyphens, length 3–48). On unique violation, return field error `That URL is taken`.
- `timezone` required `<Select>` of `Intl.supportedValuesOf("timeZone")` if available, else a static US IANA list plus `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `America/Phoenix`, `Pacific/Honolulu`
- `city` optional
Insert `schools` with `ownerUserId`. Redirect `/dashboard/settings`.

**`/dashboard`** — school name, public URL `{NEXT_PUBLIC_APP_URL}/s/{slug}` with copy button, counts of upcoming `booked` trials and of windows with `active = true`. If zero active windows, `Alert`: the chat cannot offer times until a window exists.

**`/dashboard/settings`** — `Tabs` + `Card` per group, each with its own Server Action (do not one mega-form):

| Tab | Action | Fields |
|-----|--------|--------|
| Profile | `updateSchoolProfile` | name, slug, timezone, phone, website, addressLine1, city, region, postalCode, country, parkingNotes, accessNotes |
| Trial | `updateSchoolTrialInfo` | whatToWear, arriveEarlyMinutes, waiverNotes, whatToExpect |
| Pricing | `updateSchoolPricing` | membershipsAndPricing textarea |
| FAQs | `addFaq` / `deleteFaq` | question, answer; `sortOrder = max+1`; cap 20 rows |
| Agent | `updateSchoolAgent` | welcomeMessage, agentInstructions |
| Branding | `updateSchoolBranding` | primaryColor (`<input type="color">`), logoUrl |
| Schedule | `createTrialWindow` / `updateTrialWindow` / `deleteTrialWindow` | dayOfWeek select Sun–Sat, start time `<input type="time">` stored as `startMinute`, durationMinutes, capacity (1–50), label, active switch |

Every action re-checks `getOwnedSchool()` and only updates that row. Empty text fields store `null`, not `"unknown"`.

**`/dashboard/bookings`** — `Table` of this school’s bookings, default filter upcoming (`startAt >= now()`), tabs Upcoming / Past / All. Columns: prospect name, email, phone, local start (`school.timezone`), window label, status `Badge`, actions. For `status === "booked"`, two buttons call `updateBookingAttendance(bookingId, "showed" | "no_show")`. Allow switching showed ↔ no_show. Do not send email on attendance change. No transcript UI (messages table is storage only).

### 5. Schedule math and atomic booking

`src/lib/schedule/constants.ts`:

```ts
export const SLOT_HORIZON_DAYS = 14;
export const MIN_LEAD_MINUTES = 120;
```

`src/lib/schedule/occurrences.ts` using `date-fns` + `date-fns-tz` (`fromZonedTime` / `toZonedTime`). Export:

- `slotId(windowId: string, startAt: Date): string` → `${windowId}::${startAt.toISOString()}`
- `parseSlotId(id: string): { windowId: string; startAt: Date } | null` — split on `::`, reject if either half invalid
- `listOpenSlots(school, windows, occurrences): OpenSlot[]` — for each **active** window, every local calendar date in `[now+MIN_LEAD_MINUTES, now+SLOT_HORIZON_DAYS]` whose weekday matches `dayOfWeek`; build `startAt` as that local date + `startMinute` in `school.timezone` converted to UTC; skip if `startAt` outside the window; `spotsLeft = (occurrence?.bookedCount != null ? occurrence.capacity : window.capacity) - (occurrence?.bookedCount ?? 0)`; omit if `spotsLeft <= 0`. Return `{ slotId, label, startAt, endAt, spotsLeft }`.

Do not persist occurrences until a book succeeds.

`src/lib/schedule/book-slot.ts` — `bookSlot({ school, slotId, name, email, phone, conversationId })`:

1. Parse `slotId`. Load window by id **and** `schoolId`. Reject if missing or `active === false`.
2. Re-run `listOpenSlots` for that window; reject unless `startAt` is in the open list (blocks hallucinated times).
3. Normalize `email.trim().toLowerCase()`. If a `bookings` row already exists for this school + email + that `startAt` with `status = 'booked'`, return `{ ok: false, code: "already_booked" }`.
4. Atomic occupancy via raw SQL on `getDb()` (neon-http has no interactive transaction). If `RETURNING` is empty, `{ ok: false, code: "full" }`:

```sql
INSERT INTO trial_occurrences (id, trial_window_id, school_id, start_at, capacity, booked_count)
VALUES (${newId}, ${windowId}, ${schoolId}, ${startAt}, ${window.capacity}, 1)
ON CONFLICT (trial_window_id, start_at)
DO UPDATE SET booked_count = trial_occurrences.booked_count + 1
WHERE trial_occurrences.booked_count < trial_occurrences.capacity
RETURNING id, booked_count
```

5. Find or insert `prospects` by `(schoolId, lower(email))`; update name/phone if found.
6. Insert `bookings` with `status: "booked"`, `icsUid: `${bookingId}@fillthemat``, `endAt = startAt + durationMinutes`. Link `conversationId` if present; set `conversations.prospectId`.
7. If step 6 throws after step 4, `UPDATE trial_occurrences SET booked_count = booked_count - 1 WHERE id = $id AND booked_count > 0`, then rethrow.
8. Call `sendBookingConfirmation(...)`. If email throws, catch, log, leave booking in place, return `{ ok: true, emailSent: false, booking }`. On email success set `confirmationEmailSentAt` and `{ ok: true, emailSent: true, booking }`.

### 6. Email: Resend + hand-rolled ICS

`src/lib/email/ics.ts` — `buildTrialIcs({ uid, startAt, endAt, title, description, location })` returns a `VCALENDAR` string, `METHOD:PUBLISH`, `DTSTART`/`DTEND`/`DTSTAMP` as UTC `YYYYMMDDTHHMMSSZ`. No extra ics library.

`src/lib/email/resend.ts` — lazy `new Resend(process.env.RESEND_API_KEY!)`. From = `process.env.RESEND_FROM!`.

`sendBookingConfirmation` subject: `Your trial class at {school.name}`. Body: formatted local start in `school.timezone`, duration, address lines, parking/access if set, what to wear, arrive-early minutes, school phone. Attach `trial-{slug}.ics` (`contentType: text/calendar`).

`sendBookingReminder` subject: `Reminder: trial class at {school.name} tomorrow`. Shorter body, same ICS attach.

Do not CC the owner. Do not implement SMS. Google Calendar API is not used; the `.ics` is how Google/Apple/Outlook ingest the event.

### 7. Chat agent (prospect LP)

After `npm install ai`, read `node_modules/ai/docs` and implement against **installed** AI SDK v6 APIs. Forbidden: `maxSteps`, `parameters:` on tools, `toDataStreamResponse`, `useChat({ api })`, `message.content`, `generateObject`, `Experimental_Agent`, `CoreMessage`. Required: `tool({ inputSchema })`, `stopWhen: stepCountIs(8)`, `toUIMessageStreamResponse()`, `useChat({ transport: new DefaultChatTransport(...) })`, `message.parts`, `convertToModelMessages`.

Model constant in `src/lib/ai/booking-agent.ts`:

```ts
export const BOOKING_AGENT_MODEL = "anthropic/claude-sonnet-4.6";
```

If Gateway rejects that id at runtime, switch to `openai/gpt-5.4` (confirmed live on the gateway). Tag calls `providerOptions.gateway.tags: ["feature:booking-chat"]` and `user: school.id`.

`createBookingAgent(school, ctx)` returns a `ToolLoopAgent` (or the installed equivalent agent class) with two tools only:

**`list_trial_slots`** — empty input schema. Loads active windows + existing occurrences for `school.id`, returns `listOpenSlots(...)` mapped to JSON `{ slotId, label, startsAtLocal, endsAtLocal, spotsLeft }`. Local strings via `date-fns-tz` in `school.timezone`. If no slots: `{ slots: [], reason: "none_configured" | "none_open" }`.

**`book_trial`** — `inputSchema` `{ slotId, name, email, phone }` (zod, email validated, phone min 7 chars). Calls `bookSlot`. Returns the `ok` payload, never a stack trace.

`src/lib/ai/system-prompt.ts` — `buildSystemPrompt(school, faqs)` concatenates only **non-empty** fields. Instructions, verbatim:

- You are the trial-class booking assistant for {name}. Goal: answer honestly from the facts below, then book a trial with `list_trial_slots` + `book_trial`.
- Never invent class times, prices, policies, or addresses. If a fact is missing, say you do not have it and continue toward booking.
- Never offer a time that did not come from `list_trial_slots`. Never guess a `slotId`.
- Collect name, email, and phone before `book_trial`. Confirm the local time in the school timezone before calling the tool.
- After a successful book, recap time, location, what to wear, and arrive-early guidance. If `emailSent` is false, still confirm the booking and tell them to add the time to their calendar.
- Do not process payments or sign waivers. You may describe memberships/pricing text if present.
- English only.

Facts block: name, timezone, phone, website, full address, parking, access, trial fields, membershipsAndPricing, FAQ Q/A list, plus `agentInstructions` last as “Owner extra instructions”.

No RAG. If FAQs later exceed prompt budget, still send all 20; do not add a vector store.

`src/app/api/chat/route.ts` — Node runtime (default, not `edge`). `maxDuration = 60`. POST:

1. Read `x-school-slug` (required) and `x-conversation-id` (optional UUID). 400 if slug missing.
2. Load school by slug; 404 if missing. Load faqs ordered by `sortOrder`.
3. Upsert conversation: if header id exists and belongs to this school, use it; else insert and use the new id.
4. Parse AI SDK UI messages from the request body the installed docs specify.
5. Persist the latest user message (`role`, `parts`).
6. Stream `agent.stream({ messages })` (or installed equivalent) with `toUIMessageStreamResponse()`. Set response header `x-conversation-id`.
7. On finish, persist assistant `parts`. Do not block the stream on DB writes if the SDK provides `onFinish` / `after`; if not, await persist after the stream helper allows.

`src/app/s/[slug]/page.tsx` + `layout.tsx` — no dark wrapper. Header: `logoUrl` via `next/image` if set (add the logo host to `images.remotePatterns` **or** use a plain `<img>` if the host is unknown — prefer `images.remotePatterns` with a wildcard only if Next requires a pattern; otherwise `<img>` for arbitrary owner URLs). Title = school name. Accent = `primaryColor` as `style={{ ["--school-accent" as string]: school.primaryColor }}`. `notFound()` on unknown slug.

Chat client `src/components/booking-chat.tsx` (`"use client"`):

- `useChat` + `DefaultChatTransport({ api: "/api/chat", headers: () => ({ "x-school-slug": slug, "x-conversation-id": conversationId }) })`. Keep `conversationId` in `useState`, initialize from `crypto.randomUUID()`, update from response header `x-conversation-id` if the transport exposes it; otherwise keep the client-generated UUID and send it on every request so the server can reuse it.
- Seed one assistant message from `welcomeMessage` or default `Hi! I can help you book a trial class at {name}. What are you looking for?`
- Render `message.parts` with AI Elements if `npx shadcn@latest add` from `https://elements.ai-sdk.dev/api/registry` succeeds (Conversation / Message / PromptInput — use current registry names if these 404). If the registry add fails, a minimal parts renderer (text parts only) is acceptable.
- When a `book_trial` tool part succeeds, show a confirmation card: local time, address, “check your email for a calendar invite”.

Prospects have no accounts.

### 8. Reminder cron

`vercel.ts` (not `vercel.json`; do not create both). `@vercel/config` `crons: [{ path: "/api/cron/reminders", schedule: "0 14 * * *" }]` — once daily 14:00 UTC so Hobby plans can run it.

`src/app/api/cron/reminders/route.ts` GET:

- `authorization === Bearer ${process.env.CRON_SECRET}` else 401.
- Select `bookings` where `status = 'booked'` AND `reminderEmailSentAt IS NULL` AND `startAt > now()` AND `startAt <= now() + interval '36 hours'`.
- For each, load school + prospect, `sendBookingReminder`, set `reminderEmailSentAt = now()`. Continue on per-row email failure.
- Return `{ ok: true, sent, failed }`.

This is “about a day before”, not exact 24h. If a later Pro plan wants hourly, change the cron schedule only — query stays correct (`startAt - 24h` already passed via the 36h window). Do not add Workflow `sleep` in MVP.

Local invoke: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`.

### 9. Wiring map (create these files; do not add others unless required by shadcn/Clerk)

```
src/proxy.ts
src/db/schema.ts
src/db/index.ts
src/lib/slug.ts
src/lib/auth/current-user.ts
src/lib/auth/current-school.ts
src/lib/schedule/constants.ts
src/lib/schedule/occurrences.ts
src/lib/schedule/book-slot.ts
src/lib/email/ics.ts
src/lib/email/resend.ts
src/lib/ai/system-prompt.ts
src/lib/ai/booking-agent.ts
src/app/api/chat/route.ts
src/app/api/cron/reminders/route.ts
src/app/s/[slug]/page.tsx
src/components/booking-chat.tsx
src/app/onboarding/page.tsx
src/app/dashboard/page.tsx
src/app/dashboard/settings/page.tsx
src/app/dashboard/bookings/page.tsx
drizzle.config.ts
vercel.ts
.env.example
```

Server Actions live next to the dashboard pages (`actions.ts` in those folders).

## Critical files & anchors

- `src/db/schema.ts` — occupancy unique `(trialWindowId, startAt)` and `bookedCount` check; booking capacity depends on this.
- `src/lib/schedule/book-slot.ts` — `INSERT ... ON CONFLICT ... WHERE booked_count < capacity RETURNING`; compensating decrement on insert failure.
- `src/lib/ai/booking-agent.ts` — `BOOKING_AGENT_MODEL`, two tools, `stopWhen: stepCountIs(8)`.
- `src/app/api/chat/route.ts` — school resolved from `x-school-slug` only; never trust a client `schoolId`.
- `src/proxy.ts` — Clerk session only; must not `protect` `/api/chat` or `/api/cron/reminders`.

## Verification

Prereqs: Vercel link, env pull (OIDC + Clerk + DATABASE_URL + Resend + CRON_SECRET), `npm run db:push`, `npm run dev`. Inbox can receive Resend onboarding-domain mail (or the claimed domain).

Dogfood path (this is the acceptance test; no app-wide suite required):

1. Sign up at `/sign-up`, land on `/onboarding`. Create school name `Test Academy`, slug `test-academy`, timezone your real zone.
2. Settings → Schedule: add **tomorrow’s weekday** at a time 3+ hours from now (or pick the next matching weekday), duration 60, capacity 2, label `Intro class`, active on. Fill parkingNotes `Lot behind the building`, whatToWear `Gi or athletic wear`, arriveEarlyMinutes `15`.
3. Dashboard copy link. Open `/s/test-academy` in a private window (signed out).
4. Chat: ask where to park → answer must mention the lot, not invent an address. Ask when you can come in → agent must call `list_trial_slots` and only offer generated times. Give name/email/phone and book the listed slot.
5. Observable: tool confirmation card; new `bookings` row `status=booked`; `trial_occurrences.booked_count = 1`; confirmation email arrives with an `.ics` that opens to the booked UTC instant; dashboard Bookings shows the prospect.
6. Book the same slot again with the same email → `{ code: "already_booked" }` / agent says already booked. Fill remaining capacity with a second email, then a third book → `full`.
7. Set a booking `startAt` ~20h ahead (SQL update or book a matching window) with `reminderEmailSentAt` null; `curl` the cron with `CRON_SECRET` → reminder email and `reminderEmailSentAt` set. Second curl does not send another.
8. Dashboard: mark Showed, then No-show; status updates; no extra email.
9. Unknown slug `/s/nope` → 404. `/dashboard` while signed out → Clerk sign-in.

`npm run build` must succeed with env present.

## Assumptions & contingencies

- One owner, one school, English, US-default `country`. Staff/multi-location later attaches to `schoolId`, not a rewrite of tenancy.
- If Clerk on Next 16 rejects `src/proxy.ts`, use `src/middleware.ts` with the same `clerkMiddleware` and still `auth.protect()` in dashboard/onboarding layouts.
- If AI Elements registry add fails, ship a text-parts chat UI; do not block booking.
- If `anthropic/claude-sonnet-4.6` is unauthorized on the project’s gateway, set `BOOKING_AGENT_MODEL` to `openai/gpt-5.4`.
- If daily cron is too coarse while dogfooding, only change `schedule` in `vercel.ts` to hourly (`0 * * * *`) on Pro; do not add a job queue.
- Post-trial conversion, no-show workflows, GCal free/busy, SMS, custom domains, RAG over PDFs, paid ads/UTM, and waiver e-sign stay unbuilt; the attach points are `bookings.status`, `src/lib/email/`, `trial_occurrences`, `buildSystemPrompt`, and `/s/[slug]`.
