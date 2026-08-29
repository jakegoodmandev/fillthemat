import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { funnelEvents, landingSessions, schools } from "@/db/schema";
import { hashToken } from "@/lib/crypto";
import { FUNNEL_EVENTS } from "@/lib/funnel";
import { isKnownBot } from "@/lib/request";
import { LANDING_SESSION_MINUTES } from "@/lib/schedule/constants";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    slug?: string;
    token?: string;
    preview?: boolean;
    utm?: Record<string, string | undefined>;
  };
  if (!body.slug || !body.token || body.token.length < 16) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const db = getDb();
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.slug, body.slug))
    .limit(1);
  if (!school) return Response.json({ error: "not_found" }, { status: 404 });

  const botReason = isKnownBot(request.headers.get("user-agent"));
  const isPreview = Boolean(body.preview);
  const hash = hashToken(body.token);
  const now = new Date();

  const existing = await db
    .select()
    .from(landingSessions)
    .where(
      and(
        eq(landingSessions.schoolId, school.id),
        eq(landingSessions.sessionKeyHash, hash),
      ),
    )
    .limit(1);

  let session = existing[0];
  if (!session) {
    const qualified =
      !isPreview &&
      !botReason &&
      school.approvedAt != null &&
      school.publishedAt != null;
    const [created] = await db
      .insert(landingSessions)
      .values({
        schoolId: school.id,
        sessionKeyHash: hash,
        firstSeenAt: now,
        lastSeenAt: now,
        qualifiedAt: qualified ? now : null,
        utmSource: body.utm?.utm_source?.slice(0, 200) ?? null,
        utmMedium: body.utm?.utm_medium?.slice(0, 200) ?? null,
        utmCampaign: body.utm?.utm_campaign?.slice(0, 200) ?? null,
        utmContent: body.utm?.utm_content?.slice(0, 200) ?? null,
        utmTerm: body.utm?.utm_term?.slice(0, 200) ?? null,
        isPreview,
        botExclusionReason: botReason,
      })
      .onConflictDoNothing({
        target: [landingSessions.schoolId, landingSessions.sessionKeyHash],
      })
      .returning();
    session = created;
    if (!session) {
      const [again] = await db
        .select()
        .from(landingSessions)
        .where(
          and(
            eq(landingSessions.schoolId, school.id),
            eq(landingSessions.sessionKeyHash, hash),
          ),
        )
        .limit(1);
      session = again;
    } else if (session.qualifiedAt) {
      await db.insert(funnelEvents).values({
        schoolId: school.id,
        landingSessionId: session.id,
        eventType: FUNNEL_EVENTS.sessionQualified,
        metadata: { source: "landing" },
      });
    }
  } else {
    const stale =
      now.getTime() - session.lastSeenAt.getTime() >
      LANDING_SESSION_MINUTES * 60 * 1000;
    await db
      .update(landingSessions)
      .set({
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(landingSessions.id, session.id));
    if (stale) {
      // Session key is reused past the 30-minute window; do not requalify.
    }
  }

  return Response.json({ ok: true, qualified: Boolean(session?.qualifiedAt) });
}
