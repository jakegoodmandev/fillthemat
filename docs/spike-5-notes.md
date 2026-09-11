# Spike 5 — Local dev & test surface (notes)

Evidence-backed read of how the local stack, scripts, tests, and webhook
ingress surface work today, with an opinion on what they must grow into to
support a WhatsApp webhook channel whose prod is HTTPS-public. No code
proposed.

## 1. Findings (current shape)

### 1a. `bun run setup` — `scripts/setup-local.ts`

- Asserts `bun --version` starts with `1.4.` (`scripts/setup-local.ts:17-23`)
  and that `docker info` succeeds (`scripts/setup-local.ts:25-32`). Hard
  fail otherwise — this stops early on a misconfigured machine before a
  long Supabase download.
- Writes `supabase/.env` with Google OAuth **placeholders** so
  `supabase start` boots without a Cloud client
  (`scripts/setup-local.ts:35-50`). This is the "bootstrap so Google is
  not a blocker" pattern.
- Calls `bunx supabase status -o env` and merges into `.env.local`
  (`scripts/setup-local.ts:54-60`). `mergeLocalEnv` is
  preservation-first: existing vendor secrets stay; new locals (Turnstile
  test keys, `CRON_SECRET`, `ALLOW_SELF_APPROVAL`, `NEXT_PUBLIC_DEV_AUTH`)
  are filled in only if absent (`scripts/local-env.ts:60-79`). The script
  intentionally drops any hand-set `PORT` env to prevent drift
  (`scripts/local-env.ts:62`).
- Runs `drizzle-kit migrate` with `DIRECT_URL`/`DATABASE_URL` injected
  (`scripts/setup-local.ts:62-71`), then `seedLocal()`
  (`scripts/seed-local.ts:75-152`).
- Prints a final report of the local Supabase URLs (API, Studio, Inbucket)
  and prints a copy-pasteable sign-in banner
  (`scripts/setup-local.ts:80-86`). It is **explicit about optional
  fidelity**: missing `RESEND_API_KEY` and `VERCEL_OIDC_TOKEN` are flagged
  in the output, not treated as errors.

### 1b. Port contract — `scripts/local-ports.ts`

- Allowed Next ports: `3000, 3010, … 3090` (`scripts/local-ports.ts:35`).
- Per-worktree claim lives in **`<common git dir>/fillthemat-ports/<port>`**
  where the claim file holds `<worktree path>` (`scripts/local-ports.ts:37,
  57-60`).
- The file *is* the lock: `writeFileSync(..., { flag: "wx" })` either
  succeeds or throws. If the path stored in a stale claim no longer
  exists (worktree removed), the next setup reuses the port.
- `claimAppPortForCwd` reads `NEXT_PUBLIC_SITE_URL` from
  `.env.local` (`scripts/local-ports.ts:177`). If the URL is set to a port
  the worktree claims, the port is held; otherwise the lowest free port is
  picked and the URL is rewritten to `http://127.0.0.1:30X0`
  (`scripts/local-ports.ts:84-141`).
- This is the contract that PG / Supabase ports stay **shared across
  trees**, only the Next port is per-tree.

### 1c. `bun run dev` — `scripts/dev-local.ts` (and `dev:stop`)

- Reads `.env.local`, parses `NEXT_PUBLIC_SITE_URL`, then spawns
  `bun run --bun next dev --port <port>` (`scripts/dev-local.ts:1-19`).
  Explicit comment in `AGENTS.md`: no `--port` flag; let the script set the
  port via the URL.
- `bun run dev:stop` shells `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`,
  filters its own pid, then SIGTERMs each (`scripts/stop-dev-local.ts:6-31`).
  **Per-tree cleanup** so two trees can coexist without affecting each
  other. **No pkill**, no broad SIGKILL.

### 1d. `bun run doctor` — `scripts/doctor-local.ts`

- Walks: Bun version, Docker Engine, `supabase status`, parse, required
  env keys, port eligibility, present/absent vendor keys. Print `ok`/`err`
  lines (`scripts/doctor-local.ts:11-65`).
- Doctor does **not** mutate files — it's a non-destructive probe.
- Prints status info on vendor keys: "VERCEL_OIDC_TOKEN missing (chat uses
  local stub)" / "RESEND_API_KEY missing (email deliveries log + mark
  sent)" (`scripts/doctor-local.ts:52-58`). The exact pattern of "report
  layered gradations" is reusable for WhatsApp:
  - `WHATSAPP_*` unset → stub adapter (no outbound, no real webhook)
  - All set → real Meta call

### 1e. Dev degradability — `src/lib/dev-flags.ts`

Four predicates currently:
- `isDevEmailAuthEnabled()` — `NEXT_PUBLIC_DEV_AUTH === "true"`.
- `allowSelfApproval()` — `ALLOW_SELF_APPROVAL === "true"`, only true in dev.
- `isLocalEmailNoop()` — `!RESEND_API_KEY && NODE_ENV !== "production"`.
- `isLocalAiStub()` — `!VERCEL_OIDC_TOKEN && NODE_ENV !== "production"`.

The contract is **clear**: when stubbed, the worker still advances the
state machine so cron + indexes exercise the same code paths in CI and on
laptops without keys. (`src/lib/email/deliveries.ts:96-110` is the
template.)

The setup script does **not** write `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`,
`VERCEL_OIDC_TOKEN`, `BOOKING_AGENT_MODEL` (`scripts/setup-local.ts:1-90` +
`scripts/local-env.ts:60-79`). These are "**opt-in** fidelity" — you can
add them to `.env.local` and `bun run setup` will preserve them on re-run.

### 1f. Tests — current surface

- Unit tests: `vitest.config.ts` → `src/**/*.test.ts`. Existing examples:
  `src/lib/email/ics.test.ts`, `src/lib/funnel.test.ts`,
  `src/lib/site-url.test.ts`, `src/lib/slug.test.ts`,
  `src/lib/ai/system-prompt.test.ts`. Run via `bun run test`.
- Integration tests: `vitest.integration.config.ts` → only matches
  `src/**/*.integration.test.ts`. Today only
  `src/app/dashboard/overview/queries.integration.test.ts` matches.
  Configured with `fileParallelism: false, testTimeout: 30_000`
  (`vitest.integration.config.ts:1-15`).
- Test infrastructure: `src/test/integration-env.ts`
  - `loadLocalEnv()` reads `.env.local` into `process.env`
    (`src/test/integration-env.ts:6-21`).
  - `authSql()` opens a Postgres connection with `max: 1`; allows
    integration tests to bypass Drizzle for raw SQL fixture work
    (`src/test/integration-env.ts:23-29`).
  - `insertAuthUser()` / `deleteAuthUser()` write into `auth.users`
    directly (`src/test/integration-env.ts:31-78`) — bypass for scripts
    that need to mint an `auth.users.id` that Supabase's
    `admin.createUser` would also do.
- Playwright e2e: `playwright.config.ts` reads
  `NEXT_PUBLIC_SITE_URL` from `.env.local` as `baseURL`
  (`playwright.config.ts:11-15`) — Playwright **respects the worktree
  port contract** automatically. `webServer.command` =
  `isCI ? "next start --hostname 127.0.0.1 --port <port>" : "bun run dev"`
  (`playwright.config.ts:53-57`).
- Existing e2e specs:
  `e2e/{bookings,overview,settings,smoke}.spec.ts`. Per
  `docs/e2e-testing-plan.md`, the AI chat is mocked in Playwright; real
  LLM responses wait for TesterArmy. There is no real-WhatsApp integration
  test yet.
- `vitest test:integration` script exists in `package.json` =
  `vitest run --config vitest.integration.config.ts`.

### 1g. Worktree lifecycle

- AGENTS.md + `docs/local-development.md`:
  - "Do not `supabase stop` from a child tree."
  - "Stop this worktree's frontend with `bun run dev:stop`."
  - "Reserve ports 3000–3090 for Fillthemat worktrees. If `EADDRINUSE`,
    stop and report."
  - "When finished: from the worktree `bun run dev:stop`, then from the
    repo root `git worktree remove .worktrees/<name>`."

## 2. Evidence (verbatim)

> `bunx drizzle-kit migrate` (`scripts/setup-local.ts:65-71`)

> `await claimAppPortForCwd(existing.NEXT_PUBLIC_SITE_URL).catch((error) => fail(…))`
> + `const siteUrl = localSiteUrl(appPort);`
> — `scripts/setup-local.ts:55-58`

> `export const APP_PORTS = [3000, 3010, 3020, 3030, 3040, 3050, 3060, 3070, 3080, 3090] as const;`
> — `scripts/local-ports.ts:35`

> `writeFileSync(file, \`${options.toplevel}\n\`, { flag: "wx" })`
> — `scripts/local-ports.ts:127`

> `const port = portFromSiteUrl(readEnvFile(".env.local").NEXT_PUBLIC_SITE_URL);`
> — `scripts/dev-local.ts:1-2`

> `const result = spawnSync("lsof", ["-nP", \`-iTCP:${port}\`, "-sTCP:LISTEN", "-t"], …)`
> — `scripts/stop-dev-local.ts:7-12`

> `if (!secret) return Response.json({ error: "unconfigured" }, { status: 500 });`
> — `src/app/api/webhooks/resend/route.ts:9`

> `await request.text();`
> + `if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) { … 413 }`
> — `src/app/api/webhooks/resend/route.ts:11-13`

> `if (isLocalEmailNoop()) { … await db.update(emailDeliveries).set({ state: "sent", providerId: \`local-noop:${delivery.id}\`, … }); }`
> — `src/lib/email/deliveries.ts:96-110`

> `baseURL = process.env.PLAYWRIGHT_BASE_URL ?? readEnvFile(".env.local").NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";`
> — `playwright.config.ts:11-15`

## 3. How local + test surface must expand for WhatsApp

### 3a. A new "WhatsApp stub adapter" matching the local email stub

The dev adapter must enforce three properties:

1. **Same forward-progressing state.** When `WHATSAPP_SYSTEM_USER_TOKEN`
   is missing, mark the row `state="sent"` immediately and log a synthetic
   payload. The DB rows are real so cron runs and the cron_runs table
   record the same `(reminder|sent|failed|purged)` counts.
2. **Webhook noop must periodically settle to terminal states.** Without a
   real Meta network, our local webhook will never see a `delivered` /
   `read` event for the row we just pretended to send. Integration tests
   that assert terminal state must be able to push a synthetic replay: see
   §3c.
3. **No real phone number is needed.** Boot flows should treat the
   per-school `phone_number_id` as optional. When the school has none,
   `/api/whatsapp/send` (or equivalent) returns `unconfigured` and the
   queue row stays `pending` so that the cron (or, better, a per-row
   `inline_send` path) can pick it up later.

Recommend reusing `isLocalWhatsAppNoop()` patterned exactly on
`isLocalEmailNoop` and `isLocalAiStub`. The pattern is **proven** and
**documented**, so adding a third is cheap.

### 3b. Verifying the webhook locally: three concrete options

**Option 1 — Replay harness (`scripts/webhook-replay.ts`).** Recommended.
A small CLI that reads a JSON fixture, computes
`X-Hub-Signature-256` with the local secret, and POSTs to the running dev
server at `${NEXT_PUBLIC_SITE_URL}/api/webhooks/whatsapp`. The fixture
library covers:
- Inbound user text message (`messages[0].messages[0].type=text`)
- Inbound button reply (`messages[0].messages[0].type=interactive`)
- Status update (`statuses[0].status, .id=wamid.…`)
- Template quality update (`message_template_status_update`)

This works in **vitest integration tests** too — a test can
programmatically compute the signature, POST, and assert DB state. Zero
extra npm installs.

**Option 2 — Tunnel (`cloudflared` or `ngrok`).** Optional. Pros: end-to-end
real Meta traffic. Cons: tunnels the dev server externally and shares the
public URL randomly; webhook GET handshake works, but **Meta's verify_token
must match** what's registered in App Dashboard. This adds a real-external
service to the script list, which `AGENTS.md` and `docs/local-development.md`
currently avoid. We can document it as an *optional* add (`bun run
tunnel:up`) but not require.

**Option 3 — In-process curl.** Inside a Vitest integration test, spin up a
fresh Next instance (or reuse the dev server) and curl
`/api/webhooks/whatsapp` against a fresh VM. Already possible because
`bun scripts/dev-local.ts` reads `NEXT_PUBLIC_SITE_URL`. The
`scripts/webhook-replay` script is just a friendlier CLI wrapper.

Verification code shape (hand):

```ts
const sig = crypto
  .createHmac("sha256", WHATSAPP_APP_SECRET)
  .update(rawBody, "utf8")
  .digest("hex");
fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${sig}` },
  body: rawBody,
});
```

Length-mismatch must produce `401` not `500`. `crypto.timingSafeEqual`
requires equal-length buffers. **The replay harness is the artifact that
prevents 401-vs-500 bugs in CI.**

### 3c. Integration test contract

- A `*.integration.test.ts` happy-path: send a message via the noop, **then
  POST a synthetic `delivered` event** via replay harness, then assert
  the row's `state = "delivered"`. Exercises: enqueue, claim+send, webhook
  signature verify, webhook DB update, totaling semantics.
- A second test for the GET verify handshake: Issue a
  `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=12345`,
  assert 200 with plain-text `12345`.
- A third for an idempotent retry: replay the same message id twice,
  assert no double row insert.

These tests run with `bun run test:integration` (already wired in CI later),
against the **same Supabase the developer has running locally** — which is
already the contract established by
`src/test/integration-env.ts`.

### 3d. "Locally runnable and testable" — concrete

Definition the Director can adopt:

> A WhatsApp feature is locally runnable when, with **no real Meta
> credentials in `.env.local`**, `bun run setup` succeeds, `bun run dev`
> serves, and a single integration test produces row-level evidence that
> the state machine ran end-to-end (enqueue → send → delivered).
>
> A WhatsApp feature is locally testable when, with **no real Meta
> credentials**, `bun run test:integration` runs three webhook tests
> (verify handshake, replay → row reflects state, idempotent duplicate →
> single row update) and all pass against the local Postgres.
>
> The feature is "ready for prod migration" (the Director's third milestone)
> when it also runs the same tests against `WHATSAPP_*` env populated and
> a **nightly replay** of historically captured Meta payloads
> (`scripts/webhook-replay whatsapp --captured fixture.json`) replays
> cleanly without diff-ing the resulting DB rows vs. a captured snapshot.

These three predicates map onto what we already do for email.

## 4. Contradictions / lacunae

- **No webhook replay harness exists today.** The Resend webhook lives in
  `/api/webhooks/resend/route.ts` but no fixture library or replay
  script. Adopting one for WhatsApp will copy the harness into Resend
  too — net new infra, not specific to WhatsApp.
- **No tunnel tool installed.** `which cloudflared` is empty. The repo's
  skill lock does not include any "tunnel" skill. AGENTS.md + local-development.md
  values "thin, scripted, degradable" env, so installing `cloudflared` is
  optional and out of scope for default local boot.
- **Doctor script does not check `WHATSAPP_*` keys.** Once those exist, the
  report lines should follow the same "ok/…/err" pattern as
  `RESEND_API_KEY` today (`scripts/doctor-local.ts:53-58`).
- **`bun run setup` should not silently write `WHATSAPP_*` placeholders**
  the way it does for Google Cloud. Treat them like `RESEND_API_KEY` /
  `VERCEL_OIDC_TOKEN`: **opt-in fidelity**, not boot blockers. Setup may
  print a hint: "Optional: WHATSAPP_SYSTEM_USER_TOKEN, WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN…".
- **`playwright.config.ts` will not need changes** for unit/integration tests
  because it follows `.env.local`. Playwright could later test the webhook
  surface: setup a `global-setup.ts` that signs and POSTs a fixture then
  asserts a row update; but the unit-level coverage belongs to vitest.
- **`scripts/setup-local.ts` exit semantics.** Today it calls
  `process.exit(0)` after `seedLocal()` because the postgres-js pool never
  closes (`scripts/setup-local.ts:88`). If we add a webhook stub spawn
  inside setup (we should not), it needs the same explicit `process.exit(0)`
  escape to avoid bun hanging.
- **Doctor does not report port claim health.** A `bun run doctor` could
  parse `git rev-parse --git-common-dir/fillthemat-ports/*` to list claim
  files. Worth adding as a small enhancement but not blocking.
- **No fixture library for `auth.users` mirroring.** If we unit-test
  webhook handling for school-bound messages, we need a school in the DB.
  Either reuse `scripts/seed-local.ts` (`DEMO_CONTACT_EMAIL`,
  `LOCAL_SCHOOL_SLUG`), or expose `seedLocal()` from a library function so
  tests can re-seed a clean demo state.

## 5. Risks & gotchas (specific to local/WhatsApp/dev/test)

- **`bun --bun next dev` SIGTERM sensitivity.** A `bun run dev:stop`
  writes a fresh value for `NEXT_PUBLIC_SITE_URL` ahead of stop. Re-run of
  `next dev` will rebind **even if the previous one is still listening** —
  that produces `EADDRINUSE`. The AGENTS.md contract is the only
  mitigation: stop the worktree explicitly, don't pkill.
- **`agentStore` (Playwright) is worktree-blind.** Per `playwright.config.ts`
  the suite picks up `.env.local` from the worktree, so each tree's
  Playwright tests will run against its own dev origin. **Good** — but if
  we add `webhook-replay.ts whatsapp` and run it from CI, CI must know
  which port the worktree owns.
- **`scripts/seed-local.ts` writes to `auth.users` via admin API**, not
  `authSql()` SQL insert
  (`scripts/seed-local.ts:25-43`). Test code that bypasses the admin SDK
  needs the `insertAuthUser()` helper from
  `src/test/integration-env.ts:31-50`. Otherwise tests will not have a
  matching `app.users` row for an `auth.users.id` FK.
- **`MAX_REQUEST_BYTES = 32_768`** (`src/lib/security/limits.ts:8`). Local
  WhatsApp fixtures (status updates, text messages) are well under 32k;
  ensure `requestBodyTooLarge()` reads `content-length` only — Meta's
  webhook POSTs `application/json` without a content-length but TinyGo
  proxies must be tested.
- **Local webhook port is the dev server's port.** The verify_token +
  app_secret are read at runtime from `process.env` so the running Next
  server needs the same env. Today's `setup-local.ts` does not write
  webhook secrets — Phase 1 plan should decide.
- **Integration tests mutate a real DB.** `vitest.integration.config.ts`
  doesn't isolate by project / schema. Two worktrees running integration
  tests concurrently = race conditions. Either:
  - Use a separate Supabase project per CI lane, or
  - Wrap integration tests with `fileParallelism: false` (current) and
    per-test transaction rollback (not currently implemented).
- **`scripts/dev-local.ts` not resilient to stale `.env.local`.** If
  `NEXT_PUBLIC_SITE_URL` parses to a port not in `APP_PORTS`, `dev:stop`
  fails (`scripts/dev-local.ts:1-7`). Whichever path lands `.env.local` for
  WhatsApp must keep `NEXT_PUBLIC_SITE_URL` pointing at an allowed port.
- **Noisy `tail -F` of dev logs.** Fine.

## 6. Open questions for the Director

1. **Required `.env.local` keys for WhatsApp?** Specs the Director should
   confirm:
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_SYSTEM_USER_TOKEN`
   - `WHATSAPP_API_VERSION` (default `v23.0` per Reference doc)
   - `WHATSAPP_GRAPH_BASE` (optional override for tests)
2. **`scripts/setup-local.ts` should auto-fill a stub (fake values) for
   these as dev defaults?** Recommendation: **no** — that confers "this
   looks configured" which is a bad error mode. Print a hint line and
   leave them blank unless filled.
3. **Per-tree webhook inspection.** When a worktree on `:3030` runs an
   integration test against `/api/webhooks/whatsapp`, the Next dev server
   needs a stable doc link for replay. Encrypt per-tree? Decide how
   parallel tests in two worktrees avoid signing with a shared secret.
4. **Tunnel as opt-in or out?**
   - Opt-in: requires an extra step but no dependency surface.
   - Default: still requires an extra `bun run tunnel:up` step but is
     visible in the quickstart.
5. **Replay fixture storage.** Where do captured-or-synthesized fixtures
   live? `e2e/fixtures/whatsapp/` mirrored to `src/test/fixtures/whatsapp/`
   for vitest. Recommend both.
6. **`isLocalWhatsAppNoop()` should respect same in-tree fail-fast as
   email?** Recommendation: yes — when `NODE_ENV !== "production"` and any
   required `WHATSAPP_*` key is missing, fail per-school (DB-driven)
   rather than globally so each school's onboarding is independent.
7. **Integration test isolation.** Use Supabase **shadow DB**
   (`drizzle.config.ts`'s shadow `/var/run/postgres`) or a dedicated
   `project_id`-based DB per worker? Or wrap each test in an outer
   transaction and roll back? Today no isolation; recommend per-test
   `BEGIN; … ROLLBACK;` patterns.
8. **Curling from a future webchat fixture into Next dev.** When the
   "agent channel" is web today, "agent channel" tomorrow is WhatsApp, we
   need a CI job that runs both contracts. Is the existing setup
   (one worktree = one channel) enough, or do we want a multi-channel
   matrix in CI?

## 7. Recommendation summary (not a code proposal)

Adopt the same three contracts the email path uses:

1. **Degradable dev noop.** `isLocalWhatsAppNoop()` in
   `src/lib/dev-flags.ts`. Same shape as the email noop: log + mark
   `state="sent"`. Local dev shouldn't require a real Meta account.
2. **Replay/handshake harness.** `scripts/webhook-replay.ts whatsapp`. A
   small CLI that signs and POSTs. Generically useful — once this exists
   for WhatsApp, the same pattern can be retrofitted onto Resend.
3. **Integration tests with real route handlers.** Vitest integration
   spec asserting row-level state after each step. Test fixture directory
   `src/test/fixtures/whatsapp/` (e.g. `text-inbound.json`,
   `status-delivered.json`, `button-reply.json`).

The above three, plus the **opt-in env** in `.env.example` and the
**doctor report lines**, are the minimum surface for "locally runnable
and testable." The Meta app + Verify Token + System User token + Business
verification are **out of scope** for this spike-and-plan pass — they are
DevOps setup, not local-dev infra.
