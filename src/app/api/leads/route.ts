import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  contacts,
  emailDeliveries,
  funnelEvents,
  landingSessions,
  leads,
} from "@/db/schema";
import { hashToken, normalizeEmail } from "@/lib/crypto";
import { attemptPendingForLead } from "@/lib/email/deliveries";
import { FUNNEL_EVENTS } from "@/lib/funnel";
import { getRequestIp } from "@/lib/request";
import { getPublicSchoolBySlug } from "@/lib/schools/public";
import {
  recipientQuotaExceeded,
  requestBodyTooLarge,
} from "@/lib/security/limits";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { leadRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (requestBodyTooLarge(request.headers.get("content-length"))) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }
  const parsed = leadRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;
  const school = await getPublicSchoolBySlug(body.schoolSlug);
  if (!school) return Response.json({ error: "not_found" }, { status: 404 });

  const ip = getRequestIp(request.headers);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return Response.json({ error: "verification_failed" }, { status: 403 });
  }
  if (await recipientQuotaExceeded(school.id, school.notificationEmail)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const db = getDb();
  const email = normalizeEmail(body.contact.email);

  const lead = await db.transaction(async (tx) => {
    const [contact] = await tx
      .insert(contacts)
      .values({
        schoolId: school.id,
        email,
        name: body.contact.name,
        phone: body.contact.phone,
      })
      .onConflictDoUpdate({
        target: [contacts.schoolId, contacts.email],
        set: {
          name: body.contact.name,
          phone: body.contact.phone,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!contact) throw new Error("contact_failed");

    let landingSessionId: string | undefined;
    if (body.landingSessionToken) {
      const [session] = await tx
        .select()
        .from(landingSessions)
        .where(
          eq(
            landingSessions.sessionKeyHash,
            hashToken(body.landingSessionToken),
          ),
        )
        .limit(1);
      if (session?.schoolId === school.id) landingSessionId = session.id;
    }
    if (!landingSessionId) {
      throw Object.assign(new Error("session_required"), {
        code: "session_required",
      });
    }

    const [row] = await tx
      .insert(leads)
      .values({
        schoolId: school.id,
        landingSessionId,
        contactId: contact.id,
        participantName: body.participantName,
        participantAge: body.participantAge,
        trialOfferingId: body.offeringId,
        statedNeed: body.statedNeed,
        status: "open",
      })
      .returning();
    if (!row) throw new Error("lead_failed");

    await tx.insert(emailDeliveries).values({
      schoolId: school.id,
      leadId: row.id,
      kind: "owner_lead",
      recipient: school.notificationEmail,
      providerIdempotencyKey: `owner-lead/${row.id}`,
      state: "pending",
    });
    await tx.insert(funnelEvents).values({
      schoolId: school.id,
      landingSessionId,
      leadId: row.id,
      eventType: FUNNEL_EVENTS.leadCaptured,
      metadata: { hasOffering: Boolean(body.offeringId) },
    });
    return row;
  });

  await attemptPendingForLead(lead.id);
  return Response.json({ ok: true, leadId: lead.id });
}
