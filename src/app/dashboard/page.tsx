import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { formatOwnerDateTime } from "@/components/dashboard/format";
import { PageHeader } from "@/components/dashboard/page-header";
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
  const published = school.publishedAt != null;
  const failedCount = failedEmail[0]?.count ?? 0;
  const activeOfferings = offeringCount[0]?.count ?? 0;
  const activeWindows = windowCount[0]?.count ?? 0;

  const blockers = unpublishedBlockers({
    approved: school.approvedAt != null,
    previewed: school.previewedAt != null,
    hasName: Boolean(school.name),
    hasSlug: Boolean(school.slug),
    hasTimezone: Boolean(school.timezone),
    hasNotificationEmail: Boolean(school.notificationEmail),
    hasLocation: Boolean(school.city || school.address),
    hasOffering: activeOfferings > 0,
    hasWindow: activeWindows > 0,
  });

  return (
    <main id="main-content" className="flex flex-col gap-6">
      <PageHeader title="Overview" />

      {params.error === "not_ready" ? (
        <p role="status" className="text-sm text-destructive">
          Publishing needs approval, a completed preview, location and contact
          details, and at least one active trial class and class time.
        </p>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="publication">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="publication" className="text-base font-semibold">
              Page
            </h2>
            <Badge variant={published ? "success" : "muted"}>
              {published ? "Published" : "Unpublished"}
            </Badge>
            {school.approvedAt ? null : (
              <Badge variant="warning">Awaiting approval</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={markPreviewedAction}>
              <Button
                type="submit"
                variant={published ? "outline" : "secondary"}
              >
                Preview
              </Button>
            </form>
            {published ? null : (
              <form action={publishSchoolAction}>
                <Button type="submit">Publish</Button>
              </form>
            )}
          </div>
        </div>
        {publicUrl ? (
          <p className="text-sm">
            <a
              href={publicUrl}
              className="break-all underline-offset-4 hover:underline"
            >
              {publicUrl}
            </a>
          </p>
        ) : null}
        {!published && blockers.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <Separator />

      <section
        aria-label="Summary"
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
          hint="of qualified sessions"
        />
      </section>

      <details className="text-sm">
        <summary className="cursor-pointer text-sm font-medium">
          More details
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Detail
            label="Qualified sessions"
            value={qualifiedCount}
            hint="Sessions that reached a booking-ready state"
          />
          <Detail label="Converted sessions" value={convertedCount} />
          <Detail
            label="Chat-assisted bookings"
            value={chatConverted[0]?.count ?? 0}
          />
          <Detail label="Active trial classes" value={activeOfferings} />
          <Detail label="Active class times" value={activeWindows} />
        </dl>
      </details>

      {failedCount > 0 ? (
        <p role="status" className="text-sm text-warning">
          {failedCount === 1
            ? "1 email failed to send."
            : `${failedCount} emails failed to send.`}
        </p>
      ) : null}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          System status
        </summary>
        <dl className="mt-3 grid gap-2">
          <Detail label="Email failures" value={failedCount} />
          <Detail
            label="Last maintenance"
            value={
              lastRun[0]?.finishedAt
                ? formatOwnerDateTime(lastRun[0].finishedAt, school.timezone)
                : "Never"
            }
          />
        </dl>
      </details>
    </main>
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

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Detail({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {value}
        {hint ? (
          <span className="ml-1 text-xs text-muted-foreground">({hint})</span>
        ) : null}
      </dd>
    </div>
  );
}
