# Director kickoff — WhatsApp channel for Fillthemat's AI chat + booking funnel

## Mission

Move the customer-facing AI chat that currently lives on the web at `/s/<slug>` onto WhatsApp Cloud API, so a prospect can qualify, learn about trial offerings, see open times, and (per product decision below) book or leave a lead — all inside WhatsApp, able to be run and tested locally first, then rolled out to production.

**This pass is a spike-and-plan exercise. Do not write production code.** Your only hard deliverables are (1) spike findings synthesized into a decision-ready design, and (2) a complete phased plan with local-test definitions and a production path.

---

## 0. Environment — entry worktree is ready; let subagents use their own worktrees

- Entry worktree: `/Users/jakegoodman/Code/Personal/fillthemat/.worktrees/whatsapp-integration` (branch `feat/whatsapp-integration`), fully bootstrapped and the starting point for this effort.
- Your extension spawns subagents each on their own worktree — that is expected and encouraged. Run your default orchestration; do not force everything into one tree. Just observe the shared-repo rules below for every tree (yours included).
- Port contract (non-negotiable, applies to every worktree): each tree owns its own Next origin in `http://127.0.0.1:30X0` (`3000` through `3090`), assigned by `bun run setup`. Start with plain `bun run dev` (no `--port`), stop with `bun run dev:stop`, never `pkill` Next by name, never `supabase stop` from a child tree (the machine's one Supabase is shared; `3000`, `3020`, `3030` are already claimed by other trees).
- Bootstrapping a subagent worktree: from the repo root `git worktree add .worktrees/<name> -b <branch>`, then `bun install && bun run setup` in that tree. Do not stop or recreate Supabase.
- Entry tree is already set up: `node_modules` installed, `bun run setup` run (`.env.local` written, seeded `owner@local.test` / `local-dev-password`, `/s/demo` approved-but-unpublished). A dev server may already be running on `:3010`; stop it with `bun run dev:stop` if needed.
- Reference docs you must read first: `AGENTS.md` and `docs/local-development.md` (the repo root and each worktree have identical copies).

## 1. Grounding rules — do not trust your memory

- **Next.js 16.3.3** is installed and has breaking changes vs. what you remember. Before touching any Next API, read the relevant guide under `node_modules/next/dist/docs/` (resolve from this tree).
- **AI SDK `ai@7.0.84`** is installed. Agent/tool/stream APIs change frequently; verify against `node_modules/ai/docs/` and `node_modules/ai/dist/index.d.ts`. Do not write `ai` code from memory.
- **Supabase + Postgres**: load and follow the `supabase` and `supabase-postgres-best-practices` skills before proposing any schema/migration/RLS change. All app tables are Drizzle-owned (see `src/db/schema.ts`, `drizzle/`).
- **Skills**: `skills-lock.json` is the source of truth; third-party skills only, no vendoring.
- **WhatsApp**: you are given two authoritative references — "Create an App with Meta" and "WhatsApp Cloud API Get Started" (`v23.0` endpoints, webhook `X-Hub-Signature-256`, verify-token handshake, System User + permanent token, template messages, 24-hour customer service window). Cross-check against the WhatsApp Cloud API OpenAPI spec and current Graph API version; do not assume version numbers or header formats from memory.
- **Local/dev strategy**: the repo uses degradable vendor adapters in development (see `src/lib/dev-flags.ts`: `isLocalAiStub`, `isLocalEmailNoop`). Any WhatsApp design must have the same property — a clearly defined local path **without** real Meta credentials.

## 2. Prior art from a quick throwaway spike (verify, cite, correct)

A shallow pass already found the channel seams. Treat these as leads to verify against source, not as facts:

- Agent layer is channel-agnostic: `src/lib/ai/booking-agent.ts` (`ToolLoopAgent`, model `gateway(BOOKING_AGENT_MODEL)`, tools `list_trial_offerings` / `list_trial_slots` / `prepare_booking`) and `src/lib/ai/system-prompt.ts` (immutable rules: agent prepares but **must not** create bookings/leads; tenant data treated as untrusted delimiters).
- Transport is web-specific: `src/components/booking-chat.tsx` (`useChat` + `DefaultChatTransport` → `POST /api/chat`) and `src/app/api/chat/route.ts` (`createAgentUIStreamResponse`, conversation identity by `resumeTokenHash`, `messages` stored as UIMessage `parts`).
- Booking/lead are form-only today: `POST /api/bookings` → `src/lib/schedule/book-slot.ts` (transactional, idempotency key, occupancy increment) and `POST /api/leads`; both require Turnstile and an email.
- Outbound + webhook infrastructure to cannibalize: `src/lib/email/deliveries.ts` (state-machine queue, backoff, `FOR UPDATE SKIP LOCKED`, idempotency) + `src/app/api/webhooks/resend/route.ts` (signature verify + size cap + fast ack) + `src/app/api/cron/maintenance/route.ts`.
- Data model friction points: `conversations.resumeTokenHash` (browser-cookie-derived) is the conversation key; `contacts` is unique on `(school_id, email)` and email is required; `messages` persistence fits a text channel if parts stay UIMessage-shaped.
- Open product decisions already surfaced (do **not** silently resolve): (a) do bookings/leads get created over WhatsApp by the platform (agent collects + platform writes via `bookSlot`), or does WhatsApp qualify then deep-link to `/s/<slug>`; (b) WhatsApp contacts with no email; (c) tenancy model (one shared Meta app, per-school `phone_number_id`?); (d) ship order.

## 3. Process — spike, then learn, then plan

Run the spikes as parallel sub-agent tasks, distributed across your three subagents (each in its own worktree) however your default orchestration assigns them. Each spike must return, in this exact shape:

- **Findings** with `file:line` or doc/spec citations.
- **Evidence** (actual code/docs text, quoted, not paraphrased from memory).
- **Contradictions/lacunae** (what the spike could not confirm and why).
- **Risks & gotchas** specific to the WhatsApp/local/production realities.
- **Open questions** to escalate to you (the director), not to assume.

### Spikes

1. **Web chat funnel end-to-end.** Trace `/s/<slug>` → `useChat` → `/api/chat` → `createBookingAgent` → tool outputs → persistence. Map exactly what is reusable vs. web-specific, and how `conversations`/`messages` identity and history would translate to a phone-number-keyed channel.
2. **Outbound messaging + webhook/queue infra.** Document the `email_deliveries` state machine, cron claiming, idempotency, and the Resend webhook verification, and assess how directly this maps to WhatsApp outbound sends + inbound/status webhooks (including the 24-h window and template-message constraint).
3. **Booking & lead write paths.** Detail `bookSlot` and the leads flow: idempotency, contact model, email requirement, Turnstile, landing-session requirement. Identify the minimum changes for a WhatsApp-sourced booking/lead and the security controls that must replace the browser+Turnstile trust model.
4. **WhatsApp Cloud API contract.** From the two provided docs + OpenAPI/Graph references: app/use-case setup, System User + permanent token permissions, `phone_number_id`/WABA, webhook GET verify + POST signature verification, message send/status shapes, template vs. free-form messaging, 24-h service window, and current Graph API version. Produce a precise inbound/outbound contract and a local-test approach that needs no real phone number.
5. **Local dev & test surface.** How `bun run setup` / `dev-local` / `doctor` / integration tests work, and how an inbound webhook (requiring public HTTPS in production) can be exercised locally: dev stub adapter, payload replay harness, tunnel options, and what "locally runnable and testable" should concretely mean for this feature.

Spike reports come back to **you (the director)** for §4 synthesis; subagents do not need to commit code — findings may be returned as text or written as spike notes in their own trees. Group the five scopes across your three subagents as you see fit.

## 4. Learn (you, the director, after spikes return)

- Read every spike report in full. Resolve contradictions by going to source yourself where the sub-agents disagree.
- Produce a single **channel-agnostic design** that identifies: what stays shared (agent, catalog, slot logic, bookSlot), what becomes a channel adapter (transport, identity, outbound send, booking/lead capture), and the minimal schema+config changes.
- Surface a **complete open-decisions list**, each with your recommended default, explicit "if you don't decide, I'll proceed with X" note, and what changes if the user picks otherwise.

## 5. Final deliverable — the phased plan

Structure it like this:

1. **Design summary** (one page: data flow inbound + outbound, tables, adapters, env/config). Include an ASCII/sequence sketch.
2. **Definition of "locally runnable & testable."** Spell out, concretely, what a contributor types/does to run and verify the WhatsApp flow with zero Meta credentials (e.g., dev stub adapter, webhook replay endpoint/CLI, integration tests against local Supabase, tunnel instructions for the optional real-path test).
3. **Phases.** Ordered so the flow is locally runnable/testable as early as possible and each phase is independently shippable/testable. For **each phase**: goal, concrete changes (files/tables/migrations/env), acceptance criteria, exact local test steps, and risks. End with the production phases.
4. **Open decisions** (from step 4) placed inline at the earliest phase they affect, with your recommended default.
5. **Production readiness checklist.** Meta app creation → use case → WABA + `phone_number_id` → System User + token permissions → template submission/approval → webhook HTTPS + verify/signing secrets → `App Review` (if needed for non-role users) → env vars → monitoring/idempotency/retry story → rollout order.
6. **Non-goals** (explicit): e.g., no email-auth changes in prod, no vendor skill creation, no second Docker stack, no parallel Postgres.

## 6. Output format & definition of done

- A single markdown plan written to `docs/whatsapp-plan.md` in this worktree, ready to be reviewed and then handed to an implementer.
- The plan must be actionable without asking the director anything further except at the explicit open-decision points.
- No code may be written to `src/`, `drizzle/`, `supabase/`, or `package.json` in this pass. (Writing the plan file and spike notes is fine.)
