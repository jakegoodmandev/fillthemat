# Fillthemat

Fillthemat is an AI-powered growth platform for martial arts schools that converts leads into trial classes, follow up automatically, and helps convert them into paying members.

V1 is a multi-tenant landing page and trial-booking product. See `docs/v1-plan.md`.

## Local development

Canonical setup for humans and coding agents: **`docs/local-development.md`**.

That file is a plan (current founder-alpha flow vs the target `bun run setup` bootstrap). Follow the **Current workaround** section until Phases 1–2 land. Do not treat the Google Cloud + Studio `approved_at` steps as the long-term contributor contract.

## Hosted schema

Keep the production session-pooler URI in gitignored `.env.production.local` (`DIRECT_URL` only). After `bun run db:generate` and a local `bun run db:migrate`:

```
bun run db:migrate:prod
```

## Agent skills

Skills are pinned in `skills-lock.json` (not committed skill files). Coding agents restore them via `bun run skills:install`. See `AGENTS.md`.
