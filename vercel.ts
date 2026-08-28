import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  bunVersion: "1.4.x",
  buildCommand: "bun run build",
  framework: "nextjs",
  crons: [{ path: "/api/cron/maintenance", schedule: "0 14 * * *" }],
};
