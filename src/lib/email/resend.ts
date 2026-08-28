import { Resend } from "resend";

let cached: Resend | undefined;

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!cached) {
    cached = new Resend(apiKey);
  }
  return cached;
}

export function getFromAddress(): string {
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error("RESEND_FROM is not set");
  return from;
}
