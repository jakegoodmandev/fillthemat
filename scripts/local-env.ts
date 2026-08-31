import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const LOCAL_SITE_URL = "http://127.0.0.1:3000";
export const LOCAL_DB_FALLBACK =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Cloudflare Turnstile always-pass dummy keys (public, safe for local). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export const REQUIRED_LOCAL_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
] as const;

const PRESERVE_IF_SET = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_WEBHOOK_SECRET",
  "BOOKING_AGENT_MODEL",
  "VERCEL_OIDC_TOKEN",
  "ALLOW_SELF_APPROVAL",
  "NEXT_PUBLIC_DEV_AUTH",
] as const;

const KEY_ORDER = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "ALLOW_SELF_APPROVAL",
  "NEXT_PUBLIC_DEV_AUTH",
  "BOOKING_AGENT_MODEL",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_WEBHOOK_SECRET",
  "VERCEL_OIDC_TOKEN",
];

export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return parseDotenv(readFileSync(path, "utf8"));
}

function quote(value: string): string {
  if (/^[A-Za-z0-9_./:=+@-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

export function stringifyDotenv(vars: Record<string, string>): string {
  const keys = [
    ...KEY_ORDER.filter((key) => key in vars),
    ...Object.keys(vars)
      .filter((key) => !KEY_ORDER.includes(key))
      .sort(),
  ];
  const lines = ["# Generated/merged by bun run setup. Do not commit.", ""];
  for (const key of keys) {
    lines.push(`${key}=${quote(vars[key] ?? "")}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function writeEnvFile(path: string, vars: Record<string, string>) {
  mkdirSync(dirname(path) || ".", { recursive: true });
  writeFileSync(path, stringifyDotenv(vars));
}

export type SupabaseStatusEnv = {
  apiUrl: string;
  publishableKey: string;
  dbUrl: string;
  studioUrl?: string;
  inbucketUrl?: string;
  serviceRoleKey?: string;
};

export function parseSupabaseStatusEnv(text: string): SupabaseStatusEnv {
  const env = parseDotenv(text);
  const apiUrl =
    env.API_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    env.ANON_KEY ??
    env.PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const dbUrl = env.DB_URL ?? env.DATABASE_URL ?? LOCAL_DB_FALLBACK;
  if (!apiUrl || !publishableKey) {
    throw new Error(
      "Could not read API_URL/ANON_KEY from supabase status. Is the local stack running?",
    );
  }
  return {
    apiUrl,
    publishableKey,
    dbUrl,
    studioUrl: env.STUDIO_URL,
    inbucketUrl: env.INBUCKET_URL,
    serviceRoleKey: env.SERVICE_ROLE_KEY ?? env.SERVICE_ROLE,
  };
}

export function mergeLocalEnv(
  existing: Record<string, string>,
  status: SupabaseStatusEnv,
  generatedSecret: string,
): Record<string, string> {
  const next: Record<string, string> = { ...existing };
  next.DATABASE_URL = status.dbUrl;
  next.DIRECT_URL = status.dbUrl;
  next.NEXT_PUBLIC_SUPABASE_URL = status.apiUrl;
  next.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  next.NEXT_PUBLIC_SITE_URL = existing.NEXT_PUBLIC_SITE_URL || LOCAL_SITE_URL;
  next.CRON_SECRET = existing.CRON_SECRET || generatedSecret;
  next.NEXT_PUBLIC_TURNSTILE_SITE_KEY =
    existing.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY;
  next.TURNSTILE_SECRET_KEY =
    existing.TURNSTILE_SECRET_KEY || TURNSTILE_TEST_SECRET_KEY;

  for (const key of PRESERVE_IF_SET) {
    const value = existing[key];
    if (value) next[key] = value;
  }
  return next;
}

export function missingRequiredKeys(env: Record<string, string>): string[] {
  return REQUIRED_LOCAL_KEYS.filter((key) => !env[key]);
}
