export function getRequestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headers.get("x-real-ip");
}

export function isKnownBot(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (
    /bot|crawler|spider|slurp|facebookexternalhit|preview|lighthouse|pingdom|headless/i.test(
      userAgent,
    )
  ) {
    return "user_agent";
  }
  return null;
}

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function cronSecretMatches(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const token = readBearerToken(header);
  return token === secret;
}
