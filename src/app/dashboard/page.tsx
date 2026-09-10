import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  await searchParams;
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
  const activeOfferingCount = offeringCount[0]?.count ?? 0;
  const activeWindowCount = windowCount[0]?.count ?? 0;
  const failedEmailCount = failedEmail[0]?.count ?? 0;
  const headerList = await headers();
  const publicUrl = school.publishedAt
    ? publicSchoolUrl(school.slug, headerList)
    : null;

  // Mirrors publishSchoolAction's server-side readiness check.
  const published = school.publishedAt != null;
  const ready = Boolean(
    school.approvedAt &&
      school.previewedAt &&
      school.name &&
      school.slug &&
      school.timezone &&
      school.notificationEmail &&
      (school.city || school.address) &&
      activeOfferingCount > 0 &&
      activeWindowCount > 0,
  );

  const unmet: string[] = [];
  if (!published) {
    if (!school.approvedAt) unmet.push("Awaiting approval");
    if (!school.previewedAt) unmet.push("Preview the page");
    if (!(school.city || school.address)) unmet.push("Add a city or address");
    if (activeOfferingCount === 0) unmet.push("Add a trial class");
    if (activeWindowCount === 0) unmet.push("Add a weekly class time");
  }

  return (
    <main id="main-content" className="flex flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-7 font-semibold tracking-tight">
          Overview
        </h1>
        {published ? (
          <Badge variant="success">Published</Badge>
        ) : (
          <Badge variant="muted">Unpublished</Badge>
        )}
      </header>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              Open public page
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </div>

        {unmet.length > 0 ? (
          <>
            <p className="text-sm font-medium text-foreground">
              To publish, finish:
            </p>
            <ul className="flex flex-col gap-1">
              {unmet.map((item) => (
                <li
                  key={item}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <form action={markPreviewedAction}>
            <Button type="submit" variant="outline" size="sm">
              Preview
            </Button>
          </form>
          {!published && ready ? (
            <form action={publishSchoolAction}>
              <Button type="submit" size="sm">
                Publish
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <section
        aria-label="Business summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <SummaryStat
          label="Upcoming bookings"
          value={upcoming[0]?.count ?? 0}
        />
        <SummaryStat label="Leads" value={leadCount[0]?.count ?? 0} />
        <SummaryStat
          label="Conversion rate"
          value={`${conversionRate}%`}
          title="Converted sessions ÷ qualified sessions"
        />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Funnel</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <DetailStat
            label="Qualified sessions"
            value={qualifiedCount}
            title="Sessions where a family shared contact details"
          />
          <DetailStat
            label="Converted sessions"
            value={convertedCount}
            title="Qualified sessions that booked a trial class"
          />
          <DetailStat
            label="Chat-assisted bookings"
            value={chatConverted[0]?.count ?? 0}
            title="Bookings completed with help from the chat agent"
          />
          <DetailStat
            label="Active trial classes"
            value={activeOfferingCount}
          />
          <DetailStat label="Active class times" value={activeWindowCount} />
        </dl>
      </section>

      <details className="group rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          System status
          {failedEmailCount > 0 ? (
            <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
          ) : null}
        </summary>
        <div className="px-4 pb-4">
          <Separator className="mb-3" />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Email failures</dt>
              <dd>
                {failedEmailCount > 0 ? (
                  <Badge variant="warning">{failedEmailCount} failed</Badge>
                ) : (
                  <span className="text-foreground">0</span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Last maintenance</dt>
              <dd className="text-foreground">
                {lastRun[0]?.finishedAt
                  ? formatInTimeZone(
                      lastRun[0].finishedAt,
                      school.timezone,
                      "MMM d, yyyy, h:mm a",
                    )
                  : "Never"}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </main>
  );
}

function SummaryStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number;
  title?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4" title={title}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl leading-7 font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function DetailStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={title}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
