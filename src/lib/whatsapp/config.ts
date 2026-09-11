/**
 * Dev-stub values so the webhook + replay CLI work with ZERO WHATSAPP_* env vars
 * outside production. Mirrors the `isLocalEmailNoop` / `isLocalAiStub` pattern.
 *
 * Production always resolves these from the environment and fails closed
 * (returns `null`, which the route maps to HTTP 500 "unconfigured").
 */
export const WHATSAPP_STUB_APP_SECRET = "fillthemat-local-whatsapp-app-secret";
export const WHATSAPP_STUB_VERIFY_TOKEN =
  "fillthemat-local-whatsapp-verify-token";

/** Phone number id used by the local demo school so the replay CLI round-trips. */
export const LOCAL_WHATSAPP_PHONE_NUMBER_ID = "106500000000000";

function resolveConfig(name: string, stub: string): string | null {
  const value = process.env[name];
  if (value) return value;
  return process.env.NODE_ENV !== "production" ? stub : null;
}

export function whatsappAppSecret(): string | null {
  return resolveConfig("WHATSAPP_APP_SECRET", WHATSAPP_STUB_APP_SECRET);
}

export function whatsappVerifyToken(): string | null {
  return resolveConfig("WHATSAPP_VERIFY_TOKEN", WHATSAPP_STUB_VERIFY_TOKEN);
}
