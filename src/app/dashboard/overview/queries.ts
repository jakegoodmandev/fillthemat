import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { Database } from "@/db";
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
import { FUNNEL_EVENTS } from "@/lib/funnel";

export type OverviewMetrics = {
  /** This school's bookings with status = booked and startAt >= now. */
  upcomingBookings: number;
  /** Count of this school's lead records, all time. */
  leadCount: number;
  /** Distinct qualifying public-page sessions (qualifiedAt IS NOT NULL). */
  eligibleSessions: number;
  /**
   * Distinct booking-linked session IDs that belong to the school's eligible
   * sessions. Count each session once. A later cancellation does not undo that
   * a booking was made, so cancelled bookings still count.
   */
  convertedSessions: number;
  /** Recorded booking-confirmation events with source = chat. */
  chatBookings: number;
  activeOfferings: number;
  activeWindows: number;
  failedEmailCount: number;
  lastRunFinishedAt: Date | null;
};

/**
 * Server-side, school-scoped aggregation with one consistent `now` and
 * independent concurrent reads. Throws on query failure so the caller can show
 * an unavailable state instead of substituting zeros.
 */
export async function loadOverviewMetrics(
  db: Database,
  schoolId: string,
  now: Date,
): Promise<OverviewMetrics> {
  const [
    upcoming,
    leadsRow,
    eligible,
    converted,
    chat,
    offerings,
    windows,
    failedEmail,
    lastRun,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.schoolId, schoolId),
          eq(bookings.status, "booked"),
          gte(bookings.startAt, now),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.schoolId, schoolId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landingSessions)
      .where(
        and(
          eq(landingSessions.schoolId, schoolId),
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
          eq(bookings.schoolId, schoolId),
          isNotNull(bookings.landingSessionId),
          isNotNull(landingSessions.qualifiedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.schoolId, schoolId),
          eq(funnelEvents.eventType, FUNNEL_EVENTS.bookingConfirmed),
          sql`${funnelEvents.metadata} ->> 'source' = 'chat'`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trialOfferings)
      .where(
        and(
          eq(trialOfferings.schoolId, schoolId),
          eq(trialOfferings.active, true),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trialWindows)
      .where(
        and(eq(trialWindows.schoolId, schoolId), eq(trialWindows.active, true)),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailDeliveries)
      .where(
        and(
          eq(emailDeliveries.schoolId, schoolId),
          eq(emailDeliveries.state, "failed"),
        ),
      ),
    db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(1),
  ]);

  return {
    upcomingBookings: upcoming[0]?.count ?? 0,
    leadCount: leadsRow[0]?.count ?? 0,
    eligibleSessions: eligible[0]?.count ?? 0,
    convertedSessions: converted[0]?.count ?? 0,
    chatBookings: chat[0]?.count ?? 0,
    activeOfferings: offerings[0]?.count ?? 0,
    activeWindows: windows[0]?.count ?? 0,
    failedEmailCount: failedEmail[0]?.count ?? 0,
    lastRunFinishedAt: lastRun[0]?.finishedAt ?? null,
  };
}
