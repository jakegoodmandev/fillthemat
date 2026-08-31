import { Resend } from "resend";

let cached: Resend | undefined;

export function getResendOrNull(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cached) {
    cached = new Resend(apiKey);
  }
  return cached;
}

export function getResend(): Resend {
  const resend = getResendOrNull();
  if (!resend) throw new Error("RESEND_API_KEY is not set");
  return resend;
}

export function getFromAddress(): string {
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error("RESEND_FROM is not set");
  return from;
}
