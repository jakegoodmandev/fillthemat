import { describe, expect, it } from "vitest";
import {
  LOCAL_SITE_URL,
  mergeLocalEnv,
  missingRequiredKeys,
  parseDotenv,
  parseSupabaseStatusEnv,
  stringifyDotenv,
  TURNSTILE_TEST_SECRET_KEY,
  TURNSTILE_TEST_SITE_KEY,
} from "./local-env";

describe("parseDotenv", () => {
  it("parses quoted supabase status output", () => {
    const env = parseDotenv(`
API_URL="http://127.0.0.1:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon"
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# comment
export STUDIO_URL="http://127.0.0.1:54323"
`);
    expect(env.API_URL).toBe("http://127.0.0.1:54321");
    expect(env.ANON_KEY?.startsWith("eyJ")).toBe(true);
    expect(env.STUDIO_URL).toBe("http://127.0.0.1:54323");
  });
});

describe("parseSupabaseStatusEnv", () => {
  it("maps CLI names onto Next env", () => {
    const status = parseSupabaseStatusEnv(`
API_URL=http://127.0.0.1:54321
ANON_KEY=anon-key
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SERVICE_ROLE_KEY=service-key
`);
    expect(status.apiUrl).toBe("http://127.0.0.1:54321");
    expect(status.publishableKey).toBe("anon-key");
    expect(status.serviceRoleKey).toBe("service-key");
  });
});

describe("mergeLocalEnv", () => {
  it("fills required locals and preserves vendor secrets", () => {
    const merged = mergeLocalEnv(
      {
        RESEND_API_KEY: "re_test",
        VERCEL_OIDC_TOKEN: "oidc",
        CRON_SECRET: "keep-me",
      },
      {
        apiUrl: "http://127.0.0.1:54321",
        publishableKey: "anon",
        dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
      "generated-secret",
    );
    expect(merged.NEXT_PUBLIC_SITE_URL).toBe(LOCAL_SITE_URL);
    expect(merged.CRON_SECRET).toBe("keep-me");
    expect(merged.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe(TURNSTILE_TEST_SITE_KEY);
    expect(merged.TURNSTILE_SECRET_KEY).toBe(TURNSTILE_TEST_SECRET_KEY);
    expect(merged.RESEND_API_KEY).toBe("re_test");
    expect(merged.VERCEL_OIDC_TOKEN).toBe("oidc");
    expect(missingRequiredKeys(merged)).toEqual([]);
  });

  it("does not invent Resend keys", () => {
    const merged = mergeLocalEnv(
      {},
      {
        apiUrl: "http://127.0.0.1:54321",
        publishableKey: "anon",
        dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
      "generated-secret",
    );
    expect(merged.RESEND_API_KEY).toBeUndefined();
    expect(merged.CRON_SECRET).toBe("generated-secret");
  });
});

describe("stringifyDotenv", () => {
  it("quotes values that need it", () => {
    const text = stringifyDotenv({
      CRON_SECRET: "a b",
      DATABASE_URL: "postgres://x",
    });
    expect(text).toContain('CRON_SECRET="a b"');
    expect(text).toContain("DATABASE_URL=postgres://x");
  });
});
