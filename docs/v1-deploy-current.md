# Deploy current Fillthemat (`v1` branch)

How to put **today’s code** on Vercel. This is not the full pilot launch gate in `docs/v1-plan.md`. It is “founder alpha, hosted”: one operator, real HTTPS, no claim of production-hardening.

The Vercel project already exists and is linked: `jakegoodmandev-3440s-projects/fillthemat`. Local `.vercel/` should stay uncommitted.

## What you are deploying

A Next.js 16 app on Bun 1.4 (`vercel.ts`). It needs:

| Dependency | Hosted equivalent |
| --- | --- |
| Local Docker Postgres + Auth | A **new** hosted Supabase project (not local, not a copy of some other product’s DB) |
| `http://127.0.0.1:54321` Google callback | That project’s Google callback URL |
| `onboarding@resend.dev` | Same for first deploy if you only email yourself; otherwise a verified domain |
| Turnstile test keys | Keep test keys until you want real visitors; switch to live keys before any public link |
| `VERCEL_OIDC_TOKEN` | Provided by Vercel at runtime; Gateway must allow the chosen model |

Do **not** point production at `127.0.0.1` database URLs.

## 1. Hosted Supabase

1. Create a dedicated Supabase project (empty). Prefer a second project later for preview; for this first deploy one production project is enough.
2. Disable exposing schema `app` in Data API settings (plan: browser uses Auth only).
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable/anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Transaction pooler URI (port **6543**, `?pgbouncer=true` or Supavisor transaction mode) → `DATABASE_URL`
   - Direct URI (port **5432**) → `DIRECT_URL`
4. Apply application migrations **once** against `DIRECT_URL`, never at app startup. Put the hosted session-pooler URI in gitignored `.env.production.local`, then:

```bash
bun run db:migrate:prod
```

Confirm `app.schools` exists. Revokes and `auth.users` FK are in `drizzle/0000_*.sql` and require the hosted `auth` schema (they do).

5. Turn on Google in that project:
   - New (or additional) Google Web OAuth client **or** extra redirect URIs on the existing client.
   - Authorized JavaScript origins: the Vercel production origin, and `http://127.0.0.1:3000` if you still develop locally.
   - Redirects:
     - Hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
     - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - In Supabase Auth: Google enabled, Site URL = production `https://…`, additional redirects:
     - `https://<fillthemat-host>/auth/callback`
     - `https://<fillthemat-host>/**` (preview URLs if you use them)
     - keep local callback URLs if you still run `bun dev`

## 2. Hostname and Vercel env

Pick a stable host. First deploy can use `fillthemat.vercel.app` (or the project’s `.vercel.app`). Set `NEXT_PUBLIC_SITE_URL` to that `https://` origin with no trailing slash.

Add **Production** (and Preview if you will use preview deploys) environment variables in the Vercel project. Do not upload local Docker URLs.

```
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
RESEND_API_KEY=
RESEND_FROM=onboarding@resend.dev
RESEND_WEBHOOK_SECRET=
CRON_SECRET=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
BOOKING_AGENT_MODEL=
```

Notes:

- `CRON_SECRET` must be a long random string. Cron calls `GET /api/cron/maintenance` with `Authorization: Bearer <CRON_SECRET>`. Empty secret must never authenticate (code already rejects that).
- `BOOKING_AGENT_MODEL` is required unless the team has paid Gateway access to `anthropic/claude-sonnet-4.6`. Locally a free-tier-allowed model was needed. Set the same model in Vercel.
- `DIRECT_URL` is for operator migrate commands, not required on the serverless runtime if you never migrate from the app. Harmless if set.
- Generate `RESEND_WEBHOOK_SECRET` from the Resend dashboard when you create the webhook, then paste it into Vercel.

Pull is optional; do not overwrite `.env.local` OIDC token carelessly:

```bash
bunx vercel env pull
```

## 3. Resend and cron

**First hosted alpha (you are the only recipient):** keep `RESEND_FROM=onboarding@resend.dev`. Confirmation mail only reaches the Resend account owner inbox. Fine for proving the pipeline; **not** fine for real prospects.

**Before any external prospect:**

1. Verify a sending domain (e.g. `mail.fillthemat.com`).
2. Change production `RESEND_FROM` to that domain.
3. Create webhook `https://<host>/api/webhooks/resend` for delivered/bounced/complained; set `RESEND_WEBHOOK_SECRET`.

Vercel cron is already in `vercel.ts` (`0 14 * * *` UTC → `/api/cron/maintenance`). Confirm it appears on the project after the first production deploy. Hobby/cron timing is daily; that matches founder-alpha “check the run daily,” not the pilot 5-minute schedule.

## 4. Turnstile

Test keys (always pass) are acceptable while the URL is private. For any shared link, create a production widget whose hostname matches `NEXT_PUBLIC_SITE_URL` and swap site/secret keys.

## 5. Deploy

From the repo (linked project):

```bash
bun run check
bun run test
bun run build
bunx vercel --prod
```

First production deploy will use `vercel.ts` (`bunVersion: 1.4.x`, `framework: nextjs`, cron).

Preview deploy (`bunx vercel`, no `--prod`) needs its own Supabase or you accept that preview shares production data. The plan says never share production data with preview; if you only have one hosted project, **only use `--prod`** until a second Supabase exists.

## 6. Post-deploy smoke (current product, not full plan)

1. Open the production origin, Continue with Google, land on onboarding or dashboard.
2. If the school already exists locally only, it will **not** appear on hosted Postgres. Create/configure again, or dump/restore (not recommended). Treat hosted as empty.
3. In hosted Studio, set `app.schools.approved_at` for your school.
4. Preview, publish, open `/s/<slug>` signed out.
5. Confirm a qualified session row, chat reply, and one booking.
6. Confirm `email_deliveries` rows; if From is `onboarding@resend.dev`, check the owner inbox only.
7. Hit cron once:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/maintenance
```

8. Signed-out `/dashboard` should redirect to sign-in. Unknown slug 404.

## 7. Explicitly skip on this deploy

Leave these until you resume V1 remaining work:

- Vercel WAF rules
- Verified sending domain (unless real prospects)
- Isolated preview Supabase
- PITR restore drill
- Playwright/CI against hosted
- shadcn / Elements
- Integration test suite
- Custom domain / tenant domains
- Pilot monitoring and spend-ceiling process beyond the existing $25/month Gateway budget

## 8. Rollback / data

Hosted DB is durable. There is no automated backup drill yet. Before inviting anyone else: enable Supabase backups/PITR and snapshot once after migrate.

To roll back the app, redeploy a previous Vercel deployment. Schema is forward-only; do not `push` from the laptop onto hosted.
