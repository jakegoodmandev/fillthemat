import type { ReactNode } from "react";

/**
 * Single grouped summary surface on the dashboard overview: equal cell
 * anatomy, real text links for drill-downs, no gradient/icon decor. The
 * plan calls for "label → value → context → optional action" in the same
 * positions so the row reads consistently across viewport widths.
 */

export type Metric = {
  label: string;
  value: string | number;
  /** Scope / evidence shown directly below the value. */
  context: string;
  /** Optional drill-down shown as a real text link, never a wrapping button. */
  drill: { label: string; href: string } | null;
};

export function MetricGrid({
  upcoming,
  leads,
  conversion,
}: {
  upcoming: Metric;
  leads: Metric;
  conversion: Metric;
}) {
  return (
    <section aria-label="Summary" className="flex flex-col">
      <div className="grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <MetricCell metric={upcoming} />
        <MetricCell metric={leads} />
        <MetricCell metric={conversion} />
      </div>
    </section>
  );
}

export function MetricCell({ metric }: { metric: Metric }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-1 py-3 md:px-3 md:py-4">
      <p className="text-sm text-muted-foreground">{metric.label}</p>
      <p className="text-balance text-[28px] font-semibold leading-tight tabular-nums md:text-[32px]">
        {metric.value}
      </p>
      <p className="text-xs text-muted-foreground md:text-sm">
        {metric.context}
      </p>
      {metric.drill ? (
        <p className="text-sm">
          <a
            href={metric.drill.href}
            className="underline-offset-4 hover:underline"
          >
            {metric.drill.label}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Stand-alone cell for the upcoming row's removable filter chip. */
export function ConversionMetric({ metric }: { metric: Metric }) {
  return <MetricCell metric={metric} />;
}

export function DateDisplay({
  date,
  timezone,
}: {
  date: Date | null;
  timezone: string;
}) {
  if (!date) return <>Never</>;
  return <>{formatLocalDateTime(date, timezone)}</>;
}

export function ViewLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className="underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

export function UnpublishedChecklist({
  items,
  links,
}: {
  items: string[];
  links: Record<string, string>;
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      {items.map((item) => {
        const href = links[item];
        return (
          <li key={item}>
            {href ? (
              <a href={href} className="underline-offset-4 hover:underline">
                {item}
              </a>
            ) : (
              item
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EmailWarning({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p role="status" aria-live="polite" className="text-sm text-warning">
      {count === 1
        ? "1 email failed to send."
        : `${count} emails failed to send.`}
    </p>
  );
}

export function ActivityDisclosure({
  chatAssistedBookings,
  eligibleSessions,
  convertedSessions,
  activeOfferings,
  activeWindows,
}: {
  chatAssistedBookings: number;
  eligibleSessions: number;
  convertedSessions: number;
  activeOfferings: number;
  activeWindows: number;
  timezone: string;
}) {
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <span>Booking activity and definitions</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs text-muted-foreground group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <DetailRow
          label="Eligible sessions"
          value={eligibleSessions}
          hint="Pages sessions that graduated past preview and known bots on an approved, published school. Tracking does not eliminate every bot and is not a booking-ready prospect count."
        />
        <DetailRow
          label="Converted sessions"
          value={convertedSessions}
          hint="Sessions eligible for this school that have at least one booking record. A later cancellation does not undo that a booking was made."
        />
        <DetailRow
          label="Chat-assisted bookings"
          value={chatAssistedBookings}
          hint="Booking-confirmation funnel events with source chat. Recorded events; may differ from converted sessions."
        />
        <DetailRow
          label="Active trial classes"
          value={activeOfferings}
          link={{
            label: "Manage trial classes →",
            href: "/dashboard/settings?section=offerings",
          }}
        />
        <DetailRow
          label="Active class times"
          value={activeWindows}
          link={{
            label: "Manage schedule →",
            href: "/dashboard/settings?section=schedule",
          }}
        />
      </div>
    </details>
  );
}

function DetailRow({
  label,
  value,
  hint,
  link,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm tabular-nums">{value}</span>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground text-pretty">{hint}</p>
      ) : null}
      {link ? (
        <p className="text-xs">
          <a href={link.href} className="underline-offset-4 hover:underline">
            {link.label}
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function SystemStatusDisclosure({
  failedEmailCount,
  lastCronAt,
  timezone,
}: {
  failedEmailCount: number;
  lastCronAt: Date | null;
  timezone: string;
}) {
  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground">
        <span>System status</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs text-muted-foreground group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <DetailRow
          label="Email failures"
          value={failedEmailCount}
          hint="Delivers that reached the failed state. Counted across the whole account."
        />
        <DetailRow
          label="Last maintenance"
          value={
            lastCronAt ? formatLocalDateTime(lastCronAt, timezone) : "Never"
          }
          hint="When the background routine last finished."
        />
      </div>
    </details>
  );
}

function formatLocalDateTime(date: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
