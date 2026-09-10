import { spawnSync } from "node:child_process";
import { parseSupabaseStatusEnv, readEnvFile } from "../scripts/local-env";

/**
 * Load `.env.local` into the process before any test imports the database
 * client. Integration tests run against the local Postgres from
 * `bun run setup`; we want DATABASE_URL set without each test re-importing
 * setup-local.ts (which also calls `supabase status`).
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is needed to create the throw-away Auth users
 * that own each test school (the FK on `app.users` requires a row in
 * `auth.users` first). Setup writes `SECRET_KEY`, not the service-role JWT,
 * so we read it from `supabase status` directly.
 */
const file = readEnvFile(".env.local");
for (const [key, value] of Object.entries(file)) {
  if (!process.env[key] && typeof value === "string") {
    process.env[key] = value;
  }
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const result = spawnSync("bunx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });
  if (result.status === 0 && typeof result.stdout === "string") {
    const status = parseSupabaseStatusEnv(result.stdout);
    if (status.serviceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = status.serviceRoleKey;
    }
    if (status.apiUrl && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = status.apiUrl;
    }
  }
}
