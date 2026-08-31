import {
  missingRequiredKeys,
  parseSupabaseStatusEnv,
  readEnvFile,
} from "./local-env";
import { fail, tryCapture } from "./local-process";

const ENV_LOCAL = ".env.local";

function check(ok: boolean, pass: string, failMessage: string) {
  if (ok) {
    console.log(`ok  ${pass}`);
    return true;
  }
  console.error(`err ${failMessage}`);
  return false;
}

function main() {
  let healthy = true;

  const bunVersion = process.versions.bun;
  healthy =
    check(
      Boolean(bunVersion),
      `bun ${bunVersion}`,
      "Not running under Bun. Use bun run doctor.",
    ) && healthy;
  if (bunVersion && !bunVersion.startsWith("1.4.")) {
    console.warn(`warn Expected bun 1.4.x, found ${bunVersion}`);
  }

  const docker = tryCapture("docker", ["info"]);
  healthy =
    check(
      docker.ok,
      "Docker Engine (`docker info`) — OrbStack/Desktop/Colima",
      "Docker Engine not reachable. Start OrbStack, Docker Desktop, or Colima.",
    ) && healthy;

  const status = tryCapture("bunx", ["supabase", "status", "-o", "env"]);
  healthy =
    check(
      status.ok,
      "supabase status",
      "Local Supabase is not running. bun run setup (or bun run supabase:start).",
    ) && healthy;

  if (status.ok) {
    try {
      const parsed = parseSupabaseStatusEnv(status.stdout);
      console.log(`ok  API ${parsed.apiUrl}`);
    } catch (error) {
      healthy = false;
      console.error(
        `err ${error instanceof Error ? error.message : "status parse failed"}`,
      );
    }
  }

  const env = readEnvFile(ENV_LOCAL);
  const missing = missingRequiredKeys(env);
  healthy =
    check(
      missing.length === 0,
      `${ENV_LOCAL} has required keys`,
      `${ENV_LOCAL} missing: ${missing.join(", ")}. Run bun run setup.`,
    ) && healthy;

  if (env.VERCEL_OIDC_TOKEN)
    console.log("ok  VERCEL_OIDC_TOKEN present (real chat)");
  else
    console.log(
      "…   VERCEL_OIDC_TOKEN missing (chat needs bunx vercel env pull)",
    );

  if (env.RESEND_API_KEY) console.log("ok  RESEND_API_KEY present");
  else
    console.log(
      "…   RESEND_API_KEY missing (mail will fail until the noop adapter PR)",
    );

  if (!healthy) fail("doctor found problems.");
  console.log("doctor passed.");
}

main();
