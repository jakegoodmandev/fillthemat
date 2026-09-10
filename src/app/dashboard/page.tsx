import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookings,
  cronRuns,
  emailDeliveries,
  funnelEvents,
  landingSessions,
  leads,
  trialOfferings,
  trialWindows,
} from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { FUNNEL_EVENTS } from "@/lib/funnel";
import { OverviewSection } from "./overview/overview-section";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { school } = await requireOwnedSchool();
  const params = await searchParams;
  const db = getDb();
  const now = new Date();

  const [
    qualified,
    converted,
    chatConverted,
    leadCount,
    upcoming,
    offeringCount,
    windowCount,
    failedEmail,
    lastRun,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landingSessions)
      .where(
        and(
          eq(landingSessions.schoolId, school.id),
          isNotNull(landingSessions.qualifiedAt),
        ),
      ),
    db
      .select({
        count: sql<number>`count(distinct ${bookings.landingSessionId})::int`,
      })
      .from(bookings)
      .innerJoin(
        landingSessions,
        and(
          eq(landingSessions.id, bookings.landingSessionId),
          eq(landingSessions.schoolId, bookings.schoolId),
        ),
      )
      .where(
        and(
          eq(bookings.schoolId, school.id),
          isNotNull(bookings.landingSessionId),
          isNotNull(landingSessions.qualifiedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.schoolId, school.id),
          eq(funnelEvents.eventType, FUNNEL_EVENTS.bookingConfirmed),
          sql`${funnelEvents.metadata} ->> 'source' = 'chat'`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.schoolId, school.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.schoolId, school.id),
          eq(bookings.status, "booked"),
          gte(bookings.startAt, now),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trialOfferings)
      .where(
        and(
          eq(trialOfferings.schoolId, school.id),
          eq(trialOfferings.active, true),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trialWindows)
      .where(
        and(
          eq(trialWindows.schoolId, school.id),
          eq(trialWindows.active, true),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailDeliveries)
      .where(
        and(
          eq(emailDeliveries.schoolId, school.id),
          eq(emailDeliveries.state, "failed"),
        ),
      ),
    db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(1),
  ]);

  const metrics = {
    upcomingBookings: upcoming[0]?.count ?? 0,
    leads: leadCount[0]?.count ?? 0,
    chatAssistedBookings: chatConverted[0]?.count ?? 0,
    eligibleSessions: qualified[0]?.count ?? 0,
    convertedSessions: converted[0]?.count ?? 0,
    activeOfferings: offeringCount[0]?.count ?? 0,
    activeWindows: windowCount[0]?.count ?? 0,
    failedEmailCount: failedEmail[0]?.count ?? 0,
  };

  const blockers = unpublishedBlockers({
    approved: school.approvedAt != null,
    previewed: school.previewedAt != null,
    hasName: Boolean(school.name),
    hasSlug: Boolean(school.slug),
    hasTimezone: Boolean(school.timezone),
    hasNotificationEmail: Boolean(school.notificationEmail),
    hasLocation: Boolean(school.city || school.address),
    hasOffering: metrics.activeOfferings > 0,
    hasWindow: metrics.activeWindows > 0,
  });

  return (
    <OverviewSection
      school={school}
      metrics={metrics}
      latestCronRunFinishedAt={lastRun[0]?.finishedAt ?? null}
      blockers={blockers}
      blockersLinks={{
        "Add a school name": "/dashboard/settings?section=profile",
        "Add a public page address": "/dashboard/settings?section=profile",
        "Choose a time zone": "/dashboard/settings?section=profile",
        "Add a notification email": "/dashboard/settings?section=profile",
        "Add a city or street address": "/dashboard/settings?section=profile",
        "Add an active trial class": "/dashboard/settings?section=offerings",
        "Add an active class time": "/dashboard/settings?section=schedule",
      }}
      errorParam={params.error === "not_ready" ? "not_ready" : null}
    />
  );
}

function unpublishedBlockers({
  approved,
  previewed,
  hasName,
  hasSlug,
  hasTimezone,
  hasNotificationEmail,
  hasLocation,
  hasOffering,
  hasWindow,
}: {
  approved: boolean;
  previewed: boolean;
  hasName: boolean;
  hasSlug: boolean;
  hasTimezone: boolean;
  hasNotificationEmail: boolean;
  hasLocation: boolean;
  hasOffering: boolean;
  hasWindow: boolean;
}) {
  const items: string[] = [];
  if (!approved) items.push("Awaiting approval");
  if (!previewed) items.push("Preview the public page");
  if (!hasName) items.push("Add a school name");
  if (!hasSlug) items.push("Add a public page address");
  if (!hasTimezone) items.push("Choose a time zone");
  if (!hasNotificationEmail) items.push("Add a notification email");
  if (!hasLocation) items.push("Add a city or street address");
  if (!hasOffering) items.push("Add an active trial class");
  if (!hasWindow) items.push("Add an active class time");
  return items;
}
