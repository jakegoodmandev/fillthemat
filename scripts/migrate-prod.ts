import { spawnSync } from "node:child_process";

const url = process.env.DIRECT_URL;
if (!url) {
  throw new Error(
    "DIRECT_URL is not set. Put the hosted session-pooler URI in .env.production.local.",
  );
}

const host = new URL(url).hostname;
if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
  throw new Error(`Refusing prod migrate against ${host}`);
}

console.info(`drizzle-kit migrate → ${host}`);

const result = spawnSync("bunx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: { ...process.env, DIRECT_URL: url },
});

process.exit(result.status ?? 1);
