import { spawnSync } from "node:child_process";
import { readEnvFile } from "./local-env";
import { parsePort } from "./local-ports";
import { fail } from "./local-process";

const envPort = process.env.PORT || readEnvFile(".env.local").PORT || "3000";
const port = parsePort(envPort);
if (port === undefined) {
  fail(`Invalid PORT=${envPort}. Run bun run setup.`);
}

const extra = process.argv.slice(2);
const result = spawnSync(
  "bun",
  ["run", "--bun", "next", "dev", "--port", String(port), ...extra],
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
