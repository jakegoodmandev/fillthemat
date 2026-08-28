import { attemptPendingForBooking } from "@/lib/email/deliveries";
import { getRequestIp } from "@/lib/request";
import { bookSlot } from "@/lib/schedule/book-slot";
import { getPublicSchoolBySlug } from "@/lib/schools/public";
import {
  emailBookingQuotaExceeded,
  recipientQuotaExceeded,
  requestBodyTooLarge,
} from "@/lib/security/limits";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { bookingRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (requestBodyTooLarge(request.headers.get("content-length"))) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }
  const json = await request.json();
  const parsed = bookingRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;
  const school = await getPublicSchoolBySlug(body.schoolSlug);
  if (!school) return Response.json({ error: "not_found" }, { status: 404 });

  const ip = getRequestIp(request.headers);
  const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstileOk) {
    return Response.json({ error: "verification_failed" }, { status: 403 });
  }

  if (await emailBookingQuotaExceeded(school.id, body.contact.email)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  if (await recipientQuotaExceeded(school.id, body.contact.email)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await bookSlot({
    school,
    offeringId: body.offeringId,
    slotId: body.slotId,
    idempotencyKey: body.idempotencyKey,
    contact: body.contact,
    participant: body.participant,
    landingSessionToken: body.landingSessionToken,
    conversationResumeToken: body.conversationResumeToken,
  });

  if (!result.ok) {
    const status =
      result.code === "already_booked"
        ? 409
        : result.code === "ineligible" || result.code === "invalid_slot"
          ? 400
          : 409;
    return Response.json(
      {
        error: result.code === "already_booked" ? "acknowledged" : result.code,
      },
      { status },
    );
  }

  if (!result.idempotent) {
    await attemptPendingForBooking(result.booking.id);
  }

  return Response.json({
    bookingId: result.booking.id,
    status: result.booking.status,
    startAt: result.booking.startAt,
    offeringName: result.booking.offeringNameSnapshot,
    participantName: result.booking.participantNameSnapshot,
    idempotent: result.idempotent,
  });
}
