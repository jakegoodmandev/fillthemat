import { describe, expect, it } from "vitest";
import {
  LOCAL_SITE_URL,
  mergeLocalEnv,
  missingRequiredKeys,
  parseSupabaseStatusEnv,
  stringifyDotenv,
  TURNSTILE_TEST_SECRET_KEY,
  TURNSTILE_TEST_SITE_KEY,
} from "./local-env";

describe("parseSupabaseStatusEnv", () => {
  it("maps CLI names onto Next env", () => {
    const status = parseSupabaseStatusEnv(`
API_URL="http://127.0.0.1:54321"
ANON_KEY="anon-key"
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# comment
export STUDIO_URL="http://127.0.0.1:54323"
SERVICE_ROLE_KEY=service-key
`);
    expect(status.apiUrl).toBe("http://127.0.0.1:54321");
    expect(status.publishableKey).toBe("anon-key");
    expect(status.studioUrl).toBe("http://127.0.0.1:54323");
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
    expect(merged.PORT).toBe("3000");
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

  it("binds SITE_URL to the claimed app port", () => {
    const merged = mergeLocalEnv(
      { NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" },
      {
        apiUrl: "http://127.0.0.1:54321",
        publishableKey: "anon",
        dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
      "generated-secret",
      { appPort: 3020 },
    );
    expect(merged.PORT).toBe("3020");
    expect(merged.NEXT_PUBLIC_SITE_URL).toBe("http://127.0.0.1:3020");
    expect(missingRequiredKeys(merged)).toEqual([]);
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
