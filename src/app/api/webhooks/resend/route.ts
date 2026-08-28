import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { getResend } from "@/lib/email/resend";

const MAX_BODY_BYTES = 64_000;

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "unconfigured" }, { status: 500 });

  const payload = await request.text();
  if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  let event: ReturnType<ReturnType<typeof getResend>["webhooks"]["verify"]>;
  try {
    event = getResend().webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  const providerId =
    "data" in event && event.data && "email_id" in event.data
      ? String(event.data.email_id)
      : null;
  if (!providerId) return Response.json({ ok: true });

  const state =
    event.type === "email.delivered"
      ? "delivered"
      : event.type === "email.bounced"
        ? "bounced"
        : event.type === "email.complained"
          ? "complained"
          : null;
  if (!state) return Response.json({ ok: true });

  const db = getDb();
  await db
    .update(emailDeliveries)
    .set({ state, updatedAt: new Date() })
    .where(eq(emailDeliveries.providerId, providerId));

  return Response.json({ ok: true });
}
