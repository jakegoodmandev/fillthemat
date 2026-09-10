import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { AlertCircle, ExternalLink } from "lucide-react";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const activeOfferings = offeringCount[0]?.count ?? 0;
  const activeWindows = windowCount[0]?.count ?? 0;
  const emailFailures = failedEmail[0]?.count ?? 0;

  const conversionRate =
    qualifiedCount === 0
      ? 0
      : Math.round((convertedCount / qualifiedCount) * 1000) / 10;
  const headerList = await headers();
  const publicUrl = school.publishedAt
    ? publicSchoolUrl(school.slug, headerList)
    : null;

  const isPublished = Boolean(school.publishedAt);

  // Readiness checklist calculations
  const unmetRequirements = [];
  if (!school.approvedAt) unmetRequirements.push("Awaiting school approval");
  if (!school.previewedAt)
    unmetRequirements.push("Landing page preview required");
  if (
    !school.name ||
    !school.slug ||
    !school.timezone ||
    !school.notificationEmail ||
    (!school.city && !school.address)
  ) {
    unmetRequirements.push("Location and contact details incomplete");
  }
  if (activeOfferings === 0)
    unmetRequirements.push("At least 1 active trial class required");
  if (activeWindows === 0)
    unmetRequirements.push("At least 1 active class time required");

  return (
    <main className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          {isPublished ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="warning">Unpublished</Badge>
          )}
        </div>
      </div>

      {/* Readiness & Publication surface */}
      <div className="rounded-lg border border-border bg-card p-4 text-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-foreground">
              Publication status:
            </span>
            {isPublished ? (
              <span className="text-muted-foreground">
                Your school page is live.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Publishing makes your booking page public.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {publicUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
                  <span>View page</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : null}

            <form action={markPreviewedAction}>
              <Button variant="outline" size="sm" type="submit">
                Preview page
              </Button>
            </form>

            {!isPublished ? (
              <form action={publishSchoolAction}>
                <Button variant="default" size="sm" type="submit">
                  Publish
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {params.error === "not_ready" ||
        (!isPublished && unmetRequirements.length > 0) ? (
          <div className="rounded-md border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-200/90 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-amber-300">
              <AlertCircle className="size-4 shrink-0 text-amber-400" />
              <span>
                {params.error === "not_ready"
                  ? "Cannot publish yet. The following requirements must be met:"
                  : "Requirements needed before publishing:"}
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {unmetRequirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Primary KPI row */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Upcoming bookings
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {upcoming[0]?.count ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Leads
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {leadCount[0]?.count ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Conversion rate
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {conversionRate}%
          </p>
        </div>
      </section>

      {/* Secondary details area */}
      <section className="rounded-lg border border-border bg-card/60 p-4 flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Performance details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Qualified sessions</p>
            <p className="mt-1 font-medium text-foreground">{qualifiedCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Converted sessions</p>
            <p className="mt-1 font-medium text-foreground">{convertedCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Chat-assisted bookings
            </p>
            <p className="mt-1 font-medium text-foreground">
              {chatConverted[0]?.count ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Active trial classes
            </p>
            <p className="mt-1 font-medium text-foreground">
              {activeOfferings}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active class times</p>
            <p className="mt-1 font-medium text-foreground">{activeWindows}</p>
          </div>
        </div>
      </section>

      {/* System status disclosure */}
      <details className="group rounded-lg border border-border bg-card/30 p-4 text-xs">
        <summary className="flex cursor-pointer items-center justify-between font-medium text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <span>System status</span>
            {emailFailures > 0 ? (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {emailFailures} email failure{emailFailures > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-6 text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">
              Email failures:{" "}
            </span>
            <span
              className={
                emailFailures > 0 ? "text-destructive font-semibold" : ""
              }
            >
              {emailFailures}
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              Last maintenance run:{" "}
            </span>
            {lastRun[0]?.finishedAt
              ? new Date(lastRun[0].finishedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Never"}
          </div>
        </div>
      </details>
    </main>
  );
}
