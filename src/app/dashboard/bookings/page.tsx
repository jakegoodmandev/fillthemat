import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { type Booking, bookings, emailDeliveries } from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { updateAttendanceAction } from "./actions";
import { CancelBookingButton } from "./booking-actions";

const FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

const STATUS: Record<
  string,
  { label: string; variant: "outline" | "success" | "warning" | "muted" }
> = {
  booked: { label: "Booked", variant: "outline" },
  showed: { label: "Showed", variant: "success" },
  no_show: { label: "No-show", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const EMAIL: Record<
  string,
  { label: string; tone: "muted" | "success" | "destructive" }
> = {
  sent: { label: "Sent", tone: "muted" },
  delivered: { label: "Delivered", tone: "success" },
  pending: { label: "Pending", tone: "muted" },
  claimed: { label: "Sending", tone: "muted" },
  failed: { label: "Failed", tone: "destructive" },
  bounced: { label: "Bounced", tone: "destructive" },
  complained: { label: "Complaint", tone: "destructive" },
};

function statusOf(value: string) {
  return STATUS[value] ?? { label: value, variant: "muted" as const };
}

function emailOf(value: string | undefined) {
  if (!value) return null;
  return EMAIL[value] ?? { label: value, tone: "muted" as const };
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { school } = await requireOwnedSchool();
  const { filter = "upcoming" } = await searchParams;
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.schoolId, school.id),
        filter === "upcoming"
          ? gte(bookings.startAt, now)
          : filter === "past"
            ? lt(bookings.startAt, now)
            : undefined,
      ),
    )
    .orderBy(desc(bookings.startAt));

  const deliveries = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.schoolId, school.id));
  const deliveryByBooking = new Map<string, string>();
  for (const delivery of deliveries) {
    if (delivery.bookingId) {
      deliveryByBooking.set(delivery.bookingId, delivery.state);
    }
  }

  const activeFilter = FILTERS.find((item) => item.value === filter)
    ? filter
    : "upcoming";

  const emptyCopy =
    activeFilter === "upcoming"
      ? "No upcoming bookings."
      : activeFilter === "past"
        ? "No past bookings yet."
        : "No bookings yet.";

  return (
    <main id="main-content" className="flex flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-7 font-semibold tracking-tight">
          Bookings
        </h1>
      </header>

      <nav
        aria-label="Booking filters"
        className="flex w-fit gap-1 rounded-md border bg-card p-1"
      >
        {FILTERS.map((item) => {
          const active = item.value === activeFilter;
          return (
            <a
              key={item.value}
              href={`/dashboard/bookings?filter=${item.value}`}
              aria-current={active ? "page" : undefined}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card/40 px-4 py-8 text-sm text-muted-foreground">
          {emptyCopy} Trials booked through your page will appear here.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium tabular-nums whitespace-nowrap">
                      <span className="block">
                        {formatInTimeZone(
                          booking.startAt,
                          booking.timezoneSnapshot,
                          "MMM d",
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {formatInTimeZone(
                          booking.startAt,
                          booking.timezoneSnapshot,
                          "h:mm a",
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block">
                        {booking.participantNameSnapshot}
                      </span>
                      <span className="text-muted-foreground">
                        age {booking.participantAgeSnapshot}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-52">
                      <span className="block truncate">
                        {booking.offeringNameSnapshot}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-52">
                      <span className="block truncate font-medium">
                        {booking.contactNameSnapshot}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {booking.contactEmailSnapshot}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={booking.status} />
                    </TableCell>
                    <TableCell>
                      {emailCell(deliveryByBooking.get(booking.id))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <AttendanceActions booking={booking} now={now} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked records */}
          <ul className="flex flex-col divide-y rounded-lg border bg-card md:hidden">
            {rows.map((booking) => (
              <li key={booking.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium tabular-nums">
                    {formatInTimeZone(
                      booking.startAt,
                      booking.timezoneSnapshot,
                      "MMM d, h:mm a",
                    )}
                  </p>
                  <StatusBadge value={booking.status} />
                </div>
                <p className="text-sm">
                  {booking.participantNameSnapshot}
                  <span className="text-muted-foreground">
                    {" "}
                    · age {booking.participantAgeSnapshot}
                  </span>{" "}
                  ·{" "}
                  <span className="text-foreground">
                    {booking.offeringNameSnapshot}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {booking.contactNameSnapshot}
                  {" · "}
                  {booking.contactEmailSnapshot}
                </p>
                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <span className="text-xs">
                    {emailCell(deliveryByBooking.get(booking.id))}
                  </span>
                  <div className="flex gap-1">
                    <AttendanceActions booking={booking} now={now} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function StatusBadge({ value }: { value: string }) {
  const status = statusOf(value);
  return <Badge variant={status.variant}>{status.label}</Badge>;
}

function emailCell(state: string | undefined) {
  const email = emailOf(state);
  if (!email) return <span className="text-muted-foreground">—</span>;
  const tone =
    email.tone === "destructive"
      ? "text-destructive"
      : email.tone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return <span className={tone}>{email.label}</span>;
}

function AttendanceActions({ booking, now }: { booking: Booking; now: Date }) {
  return (
    <>
      {booking.status !== "cancelled" ? (
        <>
          <form action={updateAttendanceAction}>
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="status" value="showed" />
            <Button type="submit" variant="ghost" size="sm">
              Showed
            </Button>
          </form>
          <form action={updateAttendanceAction}>
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="status" value="no_show" />
            <Button type="submit" variant="ghost" size="sm">
              No-show
            </Button>
          </form>
        </>
      ) : null}
      {booking.status === "booked" && booking.startAt > now ? (
        <CancelBookingButton bookingId={booking.id} />
      ) : null}
    </>
  );
}
