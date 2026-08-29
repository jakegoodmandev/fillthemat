# Fillthemat

Fillthemat is an AI-powered growth platform for martial arts schools that converts leads into trial classes, follow up automatically, and helps convert them into paying members.

V1 is a multi-tenant landing page and trial-booking product. See `docs/v1-plan.md`.

## Local founder alpha

1. Copy `.env.example` to `.env.local` and fill local Supabase, Resend (`onboarding@resend.dev`), Turnstile, and `CRON_SECRET` values.
2. Create `supabase/.env` with Google OAuth client credentials:

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=
```

The Google Web client callback must be `http://127.0.0.1:54321/auth/v1/callback`.

3. Start platform services and apply application migrations:

```
bun install
bun run supabase:start
bun run db:migrate
bun run dev
```

4. Sign in with Google, create a school, then set `approved_at` in local Supabase Studio (`app.schools`) before publishing.
