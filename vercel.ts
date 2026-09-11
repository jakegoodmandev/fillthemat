import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  bunVersion: "1.4.x",
  buildCommand: "bun run build",
  framework: "nextjs",
  crons: [
    { path: "/api/cron/maintenance", schedule: "0 14 * * *" },
    // Hobby-safe: Vercel's free tier only allows daily cron intervals. The
    // fast path is `after()` in the inbound webhook; this daily tick is the
    // sweeper for retries/backoff and stuck-claim recovery.
    { path: "/api/cron/whatsapp", schedule: "0 5 * * *" },
  ],
};
