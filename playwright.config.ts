import { defineConfig } from "@playwright/test";
import { readEnvFile } from "./scripts/local-env";

/**
 * Each worktree owns the origin `bun run setup` wrote into `.env.local`, so the
 * suite follows that instead of assuming :3000.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  readEnvFile(".env.local").NEXT_PUBLIC_SITE_URL ??
  "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL,
  },
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
