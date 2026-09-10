import { spawnSync } from "node:child_process";
import { readEnvFile } from "./local-env";
import { portFromSiteUrl } from "./local-ports";
import { fail } from "./local-process";

const siteUrl = readEnvFile(".env.local").NEXT_PUBLIC_SITE_URL;
const port = portFromSiteUrl(siteUrl);
if (port === undefined) {
  fail(
    "Invalid or missing NEXT_PUBLIC_SITE_URL in .env.local. Run bun run setup.",
  );
}

const extra = process.argv.slice(2);
// Worktrees share the machine's node_modules via a symlink that points outside
// the checkout; Turbopack refuses that layout. Webpack follows the symlink, so
// default to it unless the caller asked for a specific engine.
const hasEngineFlag =
  extra.includes("--turbo") ||
  extra.includes("--turbopack") ||
  extra.includes("--webpack");
const engineFlags = hasEngineFlag ? [] : ["--webpack"];
const result = spawnSync(
  "bun",
  [
    "run",
    "--bun",
    "next",
    "dev",
    "--port",
    String(port),
    ...engineFlags,
    ...extra,
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
