import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-dialog";
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
import { bookings, emailDeliveries } from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { cn } from "@/lib/utils";
import { updateAttendanceAction } from "./actions";

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

  const activeFilter =
    filter === "past" ? "past" : filter === "all" ? "all" : "upcoming";

  return (
    <main className="flex flex-col gap-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <nav
          aria-label="Booking filters"
          className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg text-xs"
        >
          <Link
            href="/dashboard/bookings?filter=upcoming"
            aria-current={activeFilter === "upcoming" ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              activeFilter === "upcoming"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Upcoming
          </Link>
          <Link
            href="/dashboard/bookings?filter=past"
            aria-current={activeFilter === "past" ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              activeFilter === "past"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Past
          </Link>
          <Link
            href="/dashboard/bookings?filter=all"
            aria-current={activeFilter === "all" ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              activeFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </Link>
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {activeFilter === "upcoming"
            ? "No upcoming trial bookings."
            : activeFilter === "past"
              ? "No past bookings recorded."
              : "No trial bookings found."}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
              {rows.map((booking) => {
                const formattedDate = formatInTimeZone(
                  booking.startAt,
                  booking.timezoneSnapshot,
                  "EEE, MMM d • h:mm a",
                );
                const deliveryState = deliveryByBooking.get(booking.id);

                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formattedDate}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {booking.participantNameSnapshot}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Age {booking.participantAgeSnapshot}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {booking.offeringNameSnapshot}
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground">
                        {booking.contactNameSnapshot}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {booking.contactEmailSnapshot}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <EmailStatus deliveryState={deliveryState} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {booking.status !== "cancelled" ? (
                          <>
                            <form action={updateAttendanceAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={booking.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="showed"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300"
                              >
                                Showed
                              </Button>
                            </form>
                            <form action={updateAttendanceAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={booking.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="no_show"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="h-7 px-2 text-xs text-amber-400 hover:bg-amber-950/30 hover:text-amber-300"
                              >
                                No-show
                              </Button>
                            </form>
                          </>
                        ) : null}
                        {booking.status === "booked" &&
                        booking.startAt > now ? (
                          <CancelBookingButton
                            bookingId={booking.id}
                            participantName={booking.participantNameSnapshot}
                            offeringName={booking.offeringNameSnapshot}
                            formattedDate={formattedDate}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "booked":
      return <Badge variant="outline">Booked</Badge>;
    case "showed":
      return <Badge variant="success">Showed</Badge>;
    case "no_show":
      return <Badge variant="warning">No-show</Badge>;
    case "cancelled":
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmailStatus({ deliveryState }: { deliveryState?: string }) {
  if (!deliveryState) return <span>—</span>;
  switch (deliveryState) {
    case "sent":
      return <span className="text-emerald-400">Sent</span>;
    case "failed":
      return <span className="text-destructive font-medium">Failed</span>;
    case "pending":
      return <span className="text-amber-400">Pending</span>;
    case "skipped":
      return <span className="text-muted-foreground">Skipped</span>;
    default:
      return <span>{deliveryState}</span>;
  }
}
