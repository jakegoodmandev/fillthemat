<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development

Before running the app, changing env files, Supabase config, auth, or onboarding docs, read **`docs/local-development.md`**. That is the source of truth for the local stack (current workaround and the planned `bun run setup` bootstrap). Do not add a vendored skill for this; keep third-party skills in `skills-lock.json` only.

## Agent skills

`skills-lock.json` is the only source of truth for project skills. Do not vendor skill files or commit generated skill directories (`.agents/skills/`, `.pi/skills/`).

At the start of a session:

1. Read `skills-lock.json`.
2. If those skills are missing locally, run `bun run skills:install`.
3. Load and follow every installed skill that applies to the current task.
4. If the task needs a running app or local Supabase, follow `docs/local-development.md`.

`bun run skills:install` restores every skill listed in the lockfile. Add or refresh skills with `bun run skills:update` or `bunx skills add <package> --skill <name> -y`.
