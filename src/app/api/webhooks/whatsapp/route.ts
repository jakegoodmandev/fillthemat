import {
  WHATSAPP_MAX_BODY_BYTES,
  whatsappAppSecret,
  whatsappVerifyToken,
} from "@/lib/whatsapp/config";
import { applyWhatsAppStatuses } from "@/lib/whatsapp/deliveries";
import { enqueueInboundJobs } from "@/lib/whatsapp/jobs";
import { parseInboundWhatsAppMessages } from "@/lib/whatsapp/parse";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/signature";
import { parseInboundWhatsAppStatuses } from "@/lib/whatsapp/status";

/**
 * The body is read with `request.text()` BEFORE any signature check so the
 * HMAC is computed over the exact raw bytes Meta signed — never
 * `request.json()` first. Size cap matches the Resend webhook.
 */
export async function GET(request: Request) {
  const verifyToken = whatsappVerifyToken();
  if (!verifyToken) {
    return Response.json({ error: "unconfigured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge !== null) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return Response.json({ error: "verification_failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const secret = whatsappAppSecret();
  if (!secret) return Response.json({ error: "unconfigured" }, { status: 500 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > WHATSAPP_MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";
  if (!verifyWhatsAppSignature(rawBody, signatureHeader, secret)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  // Enqueue-then-ack (decision D12): the webhook never runs the agent. Inbound
  // messages become `whatsapp_jobs` rows (idempotent by wamid) for the worker;
  // status callbacks are applied directly by `provider_id` (wamid). Always ack
  // 200 fast so Meta does not retry the whole webhook on a small/unknown event.
  const statuses = parseInboundWhatsAppStatuses(payload);
  const messages = parseInboundWhatsAppMessages(payload);
  try {
    if (statuses.length > 0) await applyWhatsAppStatuses(statuses);
    if (messages.length > 0) await enqueueInboundJobs(messages);
  } catch (error) {
    console.error("whatsapp: webhook enqueue/status failed", error);
  }

  return Response.json({ ok: true });
}
