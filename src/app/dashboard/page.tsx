import { headers } from "next/headers";
import Link from "next/link";
import { formatOwnerDateTime } from "@/components/dashboard/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getDb } from "@/db";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { publicSchoolUrl } from "@/lib/site-url";
import { markPreviewedAction, publishSchoolAction } from "./actions";
import {
  formatConversionRate,
  formatConversionScope,
} from "./overview/metrics";
import { loadOverviewMetrics } from "./overview/queries";
import { type SectionId, sectionHref } from "./settings/sections";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { school } = await requireOwnedSchool();
  const params = await searchParams;
  const headerList = await headers();
  const published = school.publishedAt != null;
  const publicUrl = published ? publicSchoolUrl(school.slug, headerList) : null;

  const metrics = await loadOverviewMetrics(
    getDb(),
    school.id,
    new Date(),
  ).catch(() => null);

  const readiness = readinessItems({
    approved: school.approvedAt != null,
    previewed: school.previewedAt != null,
    hasName: Boolean(school.name),
    hasSlug: Boolean(school.slug),
    hasTimezone: Boolean(school.timezone),
    hasNotificationEmail: Boolean(school.notificationEmail),
    hasLocation: Boolean(school.city || school.address),
    hasOffering: metrics ? metrics.activeOfferings > 0 : null,
    hasWindow: metrics ? metrics.activeWindows > 0 : null,
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
              Public page
            </h2>
            <Badge variant={published ? "success" : "muted"}>
              {published ? "Published" : "Unpublished"}
            </Badge>
            {school.approvedAt ? null : (
              <Badge variant="warning">Awaiting approval</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {publicUrl ? (
              <Button asChild variant="outline">
                <a href={publicUrl}>View Page</a>
              </Button>
            ) : null}
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

        {!published && readiness.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {readiness.map((item) => (
              <li key={item.label} className="text-sm text-muted-foreground">
                {item.href ? (
                  <Link
                    href={sectionHref(item.href)}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Separator />

      {metrics ? (
        <OverviewSummary
          upcomingBookings={metrics.upcomingBookings}
          leadCount={metrics.leadCount}
          eligibleSessions={metrics.eligibleSessions}
          convertedSessions={metrics.convertedSessions}
          chatBookings={metrics.chatBookings}
          activeOfferings={metrics.activeOfferings}
          activeWindows={metrics.activeWindows}
          failedEmailCount={metrics.failedEmailCount}
          lastRunFinishedAt={metrics.lastRunFinishedAt}
          timezone={school.timezone}
        />
      ) : (
        <section
          aria-label="Summary unavailable"
          className="rounded-lg border border-border bg-card/40 p-4"
        >
          <p className="text-sm font-medium">Metrics unavailable right now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We could not read your booking activity. Nothing was changed.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/dashboard">Reload</Link>
          </Button>
        </section>
      )}
    </main>
  );
}

function OverviewSummary({
  upcomingBookings,
  leadCount,
  eligibleSessions,
  convertedSessions,
  chatBookings,
  activeOfferings,
  activeWindows,
  failedEmailCount,
  lastRunFinishedAt,
  timezone,
}: {
  upcomingBookings: number;
  leadCount: number;
  eligibleSessions: number;
  convertedSessions: number;
  chatBookings: number;
  activeOfferings: number;
  activeWindows: number;
  failedEmailCount: number;
  lastRunFinishedAt: Date | null;
  timezone: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="summary-heading"
        className="overflow-hidden rounded-lg border border-border bg-card/40"
      >
        <h2 id="summary-heading" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <SummaryCell
            label="Upcoming bookings"
            value={String(upcomingBookings)}
            scope="Scheduled from now"
            action={{
              label: "View bookings",
              href: "/dashboard/bookings?filter=upcoming&status=booked",
            }}
          />
          <SummaryCell
            label="Leads"
            value={String(leadCount)}
            scope="All time"
            action={{ label: "View leads", href: "/dashboard/leads" }}
          />
          <SummaryCell
            label="Booking conversion"
            value={formatConversionRate(convertedSessions, eligibleSessions)}
            scope={formatConversionScope(convertedSessions, eligibleSessions)}
            subScope="All time"
          />
        </dl>
      </section>

      <section aria-labelledby="booking-activity">
        <details className="text-sm">
          <summary
            id="booking-activity"
            className="cursor-pointer text-sm font-medium"
          >
            Booking activity and definitions
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Definition
              label="Eligible sessions"
              value={String(eligibleSessions)}
            >
              Public-page sessions that reached a booking-ready state on an
              approved, published page. Preview and known-bot sessions are
              excluded, but some bots may still slip through; these are not
              booking-ready prospects.
            </Definition>
            <Definition
              label="Converted sessions"
              value={String(convertedSessions)}
            >
              Eligible sessions with at least one booking. Each session counts
              once, even with several bookings, and a later cancellation still
              counts — a booking was made.
            </Definition>
            <Definition
              label="Chat-assisted bookings"
              value={String(chatBookings)}
            >
              Recorded booking-confirmation events with source “chat”. This is a
              count of recorded events, not a deduplicated booking total.
            </Definition>
          </dl>
        </details>
      </section>

      <section aria-labelledby="setup-heading" className="flex flex-col gap-2">
        <h2 id="setup-heading" className="text-sm font-semibold">
          Setup
        </h2>
        <p className="text-sm text-muted-foreground">
          <Link
            href={sectionHref("offerings")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {activeOfferings} active trial{" "}
            {activeOfferings === 1 ? "class" : "classes"}
          </Link>
          {" · "}
          <Link
            href={sectionHref("schedule")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {activeWindows} active class{" "}
            {activeWindows === 1 ? "time" : "times"}
          </Link>
        </p>
      </section>

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer text-sm font-medium">
          <span className="text-foreground">System status</span>
          {failedEmailCount > 0 ? (
            <span className="ml-2 text-warning">
              {failedEmailCount}{" "}
              {failedEmailCount === 1 ? "email failure" : "email failures"}
            </span>
          ) : null}
        </summary>
        <dl className="mt-3 grid gap-2">
          <Detail label="Email failures" value={failedEmailCount} />
          <Detail
            label="Last maintenance"
            value={
              lastRunFinishedAt
                ? formatOwnerDateTime(lastRunFinishedAt, timezone)
                : "Never"
            }
          />
        </dl>
      </details>

      {failedEmailCount > 0 ? (
        <p role="status" className="text-sm text-warning">
          {failedEmailCount === 1
            ? "1 email failed to send."
            : `${failedEmailCount} emails failed to send.`}
        </p>
      ) : null}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  scope,
  subScope,
  action,
}: {
  label: string;
  value: string;
  scope: string;
  subScope?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">
        {scope}
        {subScope ? ` · ${subScope}` : ""}
      </dd>
      {action ? (
        <dd className="mt-1">
          <Link
            href={action.href}
            className="text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            {action.label} →
          </Link>
        </dd>
      ) : null}
    </div>
  );
}

function Definition({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">
        {label}{" "}
        <span className="ml-1 font-medium text-foreground tabular-nums">
          {value}
        </span>
      </dt>
      <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

type ReadinessItem = { label: string; href: SectionId | null };

function readinessItems({
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
  hasOffering: boolean | null;
  hasWindow: boolean | null;
}): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  if (!approved) items.push({ label: "Awaiting approval", href: null });
  if (!previewed) items.push({ label: "Preview the public page", href: null });
  if (!hasName) items.push({ label: "Add a school name", href: "profile" });
  if (!hasSlug)
    items.push({ label: "Add a public page address", href: "profile" });
  if (!hasTimezone)
    items.push({ label: "Choose a time zone", href: "profile" });
  if (!hasNotificationEmail)
    items.push({ label: "Add a notification email", href: "profile" });
  if (!hasLocation)
    items.push({ label: "Add a city or street address", href: "profile" });
  if (hasOffering === false)
    items.push({ label: "Add an active trial class", href: "offerings" });
  if (hasWindow === false)
    items.push({ label: "Add an active class time", href: "schedule" });
  return items;
}
