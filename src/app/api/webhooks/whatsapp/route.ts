import {
  WHATSAPP_MAX_BODY_BYTES,
  whatsappAppSecret,
  whatsappVerifyToken,
} from "@/lib/whatsapp/config";
import { persistInboundMessage } from "@/lib/whatsapp/inbound";
import { parseInboundWhatsAppMessages } from "@/lib/whatsapp/parse";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/signature";

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

  // Persist each inbound message (dedupe by wamid) but always ack 200 fast so
  // Meta does not retry the whole webhook on an unknown/empty message.
  for (const message of parseInboundWhatsAppMessages(payload)) {
    try {
      await persistInboundMessage(message);
    } catch (error) {
      console.error("whatsapp: inbound persist failed", error);
    }
  }

  return Response.json({ ok: true });
}
