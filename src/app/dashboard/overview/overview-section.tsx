import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { publicSchoolUrl } from "@/lib/site-url";
import { markPreviewedAction, publishSchoolAction } from "../actions";
import {
  ActivityDisclosure,
  ConversionMetric,
  DateDisplay,
  EmailWarning,
  type Metric,
  MetricCell,
  MetricGrid,
  SystemStatusDisclosure,
  UnpublishedChecklist,
  ViewLink,
} from "./overview-components";

type School = {
  id: string;
  name: string;
  slug: string;
  publishedAt: Date | null;
  approvedAt: Date | null;
  previewedAt: Date | null;
  timezone: string;
};

type OverviewProps = {
  school: School;
  /**
   * Counts expected to be precomputed server-side. The page reads them via
   * independent parallel queries; this component renders them.
   */
  metrics: {
    upcomingBookings: number;
    leads: number;
    chatAssistedBookings: number;
    eligibleSessions: number;
    convertedSessions: number;
    activeOfferings: number;
    activeWindows: number;
    failedEmailCount: number;
  };
  latestCronRunFinishedAt: Date | null;
  blockers: string[];
  blockersLinks?: Record<string, string>;
  errorParam: string | null;
};

/**
 * New-cozy owner overview: compact publication status, a single grouped
 * summary surface, and disclosures for the deeper definitions.
 */
export async function OverviewSection({
  school,
  metrics,
  latestCronRunFinishedAt,
  blockers,
  blockersLinks,
  errorParam,
}: OverviewProps) {
  const headerList = await headers();
  const publicUrlPromise = school.publishedAt
    ? Promise.resolve(publicSchoolUrl(school.slug, headerList))
    : Promise.resolve(null);

  const upcoming: Metric = {
    label: "Upcoming bookings",
    value: metrics.upcomingBookings,
    drill: {
      label: "View bookings →",
      href: "/dashboard/bookings?filter=upcoming&status=booked",
    },
    context: "Scheduled from now",
  };
  const leads: Metric = {
    label: "Leads",
    value: metrics.leads,
    drill: { label: "View leads →", href: "/dashboard/leads" },
    context: "All time",
  };
  const conversion = renderConversion(metrics);

  return (
    <main id="main-content" className="flex flex-col gap-6">
      <PageHeader title="Overview" />

      <PublicStatus
        school={school}
        publicUrl={publicUrlPromise}
        blockers={blockers}
        blockersLinks={blockersLinks ?? {}}
        errorParam={errorParam}
      />

      <Separator />

      <MetricGrid upcoming={upcoming} leads={leads} conversion={conversion} />

      <ActivityDisclosure
        chatAssistedBookings={metrics.chatAssistedBookings}
        eligibleSessions={metrics.eligibleSessions}
        convertedSessions={metrics.convertedSessions}
        activeOfferings={metrics.activeOfferings}
        activeWindows={metrics.activeWindows}
        timezone={school.timezone}
      />

      <EmailWarning count={metrics.failedEmailCount} />

      <SystemStatusDisclosure
        failedEmailCount={metrics.failedEmailCount}
        lastCronAt={latestCronRunFinishedAt}
        timezone={school.timezone}
      />
    </main>
  );
}

export type { Metric };

function renderConversion(metrics: OverviewProps["metrics"]) {
  const eligible = metrics.eligibleSessions;
  const converted = metrics.convertedSessions;
  let value: string | number;
  let context: string;
  if (eligible === 0) {
    value = "—";
    context = "No eligible sessions yet";
  } else if (converted === 0) {
    value = "0%";
    context = `0 of ${eligible} eligible sessions`;
  } else {
    const percent = Math.round((converted / eligible) * 1000) / 10;
    value = `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
    context = `${converted} of ${eligible} eligible · All time`;
  }
  return {
    label: "Booking conversion",
    value,
    drill: null,
    context,
  } satisfies Metric;
}

async function PublicStatus({
  school,
  publicUrl,
  blockers,
  blockersLinks,
  errorParam,
}: {
  school: School;
  publicUrl: Promise<string | null>;
  blockers: string[];
  blockersLinks: Record<string, string>;
  errorParam: string | null;
}) {
  const url = await publicUrl;
  const published = school.publishedAt != null;
  return (
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
          {published ? (
            <PublicLinks url={url} />
          ) : (
            <>
              <form action={markPreviewedAction}>
                <Button type="submit" variant="secondary">
                  Preview
                </Button>
              </form>
              <form action={publishSchoolAction}>
                <Button type="submit">Publish</Button>
              </form>
            </>
          )}
        </div>
      </div>
      {errorParam === "not_ready" ? (
        <p role="status" className="text-sm text-destructive">
          Publishing still needs: approval, a completed preview, location and
          contact details, and at least one active trial class and class time.
        </p>
      ) : null}
      {!published && blockers.length > 0 ? (
        <UnpublishedChecklist items={blockers} links={blockersLinks} />
      ) : null}
    </section>
  );
}

function PublicLinks({ url }: { url: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      {url ? (
        <Button asChild variant="outline">
          <Link href={url} prefetch={false}>
            View Page
          </Link>
        </Button>
      ) : null}
      {url ? (
        <Button asChild variant="outline">
          <Link
            href={`${url.startsWith("http") ? url : `http://127.0.0.1:3000${url}`}?preview=1`}
            prefetch={false}
          >
            Preview
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

// Re-export stable names for the page.tsx writer.
export {
  ActivityDisclosure,
  ConversionMetric,
  DateDisplay,
  EmailWarning,
  MetricCell,
  MetricGrid,
  SystemStatusDisclosure,
  UnpublishedChecklist,
  ViewLink,
};
