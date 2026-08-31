import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
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
import { publicSchoolUrl } from "@/lib/site-url";
import { markPreviewedAction, publishSchoolAction } from "./actions";

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
      .where(
        and(
          eq(bookings.schoolId, school.id),
          isNotNull(bookings.landingSessionId),
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

  const qualifiedCount = qualified[0]?.count ?? 0;
  const convertedCount = converted[0]?.count ?? 0;
  const conversionRate =
    qualifiedCount === 0
      ? 0
      : Math.round((convertedCount / qualifiedCount) * 1000) / 10;
  const headerList = await headers();
  const publicUrl = school.publishedAt
    ? publicSchoolUrl(school.slug, headerList)
    : null;

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {params.error === "not_ready" ? (
        <p className="text-sm text-red-400">
          Publishing needs approval, a completed preview, location/contact
          facts, and at least one active offering and window.
        </p>
      ) : null}
      <section className="rounded-xl border border-zinc-800 p-4 text-sm">
        <p>Status: {school.publishedAt ? "Published" : "Unpublished"}</p>
        <p>
          Approved:{" "}
          {school.approvedAt
            ? "yes"
            : "no (local: ALLOW_SELF_APPROVAL or set approved_at in Studio)"}
        </p>
        <p>Previewed: {school.previewedAt ? "yes" : "no"}</p>
        {publicUrl ? <p>Public URL: {publicUrl}</p> : null}
        <div className="mt-4 flex gap-3">
          <form action={markPreviewedAction}>
            <button
              type="submit"
              className="rounded-full border border-zinc-600 px-4 py-2"
            >
              Preview landing page
            </button>
          </form>
          <form action={publishSchoolAction}>
            <button
              type="submit"
              className="rounded-full bg-foreground px-4 py-2 text-background"
            >
              Publish
            </button>
          </form>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <Stat label="Qualified sessions" value={qualifiedCount} />
        <Stat label="Converted sessions" value={convertedCount} />
        <Stat label="Conversion rate" value={`${conversionRate}%`} />
        <Stat
          label="Chat-assisted bookings"
          value={chatConverted[0]?.count ?? 0}
        />
        <Stat label="Leads" value={leadCount[0]?.count ?? 0} />
        <Stat label="Upcoming bookings" value={upcoming[0]?.count ?? 0} />
        <Stat label="Active offerings" value={offeringCount[0]?.count ?? 0} />
        <Stat label="Active windows" value={windowCount[0]?.count ?? 0} />
        <Stat label="Email failures" value={failedEmail[0]?.count ?? 0} />
        <Stat
          label="Last maintenance"
          value={lastRun[0]?.finishedAt?.toISOString() ?? "never"}
        />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <p className="text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-medium">{value}</p>
    </div>
  );
}
