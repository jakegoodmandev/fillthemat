import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, emailDeliveries } from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { cancelBookingAction, updateAttendanceAction } from "./actions";

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

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <nav className="flex gap-3 text-sm">
        <a href="/dashboard/bookings?filter=upcoming">Upcoming</a>
        <a href="/dashboard/bookings?filter=past">Past</a>
        <a href="/dashboard/bookings?filter=all">All</a>
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2">When</th>
              <th>Participant</th>
              <th>Contact</th>
              <th>Offering</th>
              <th>Status</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => (
              <tr key={booking.id} className="border-b border-zinc-900">
                <td className="py-2">
                  {formatInTimeZone(
                    booking.startAt,
                    booking.timezoneSnapshot,
                    "MMM d, h:mm a",
                  )}
                </td>
                <td>
                  {booking.participantNameSnapshot} (
                  {booking.participantAgeSnapshot})
                </td>
                <td>
                  {booking.contactNameSnapshot}
                  <div className="text-zinc-500">
                    {booking.contactEmailSnapshot}
                  </div>
                </td>
                <td>{booking.offeringNameSnapshot}</td>
                <td>{booking.status}</td>
                <td>{deliveryByBooking.get(booking.id) ?? "—"}</td>
                <td>
                  <div className="flex flex-col gap-1">
                    {booking.status !== "cancelled" ? (
                      <>
                        <form action={updateAttendanceAction}>
                          <input type="hidden" name="id" value={booking.id} />
                          <input type="hidden" name="status" value="showed" />
                          <button type="submit" className="underline">
                            Showed
                          </button>
                        </form>
                        <form action={updateAttendanceAction}>
                          <input type="hidden" name="id" value={booking.id} />
                          <input type="hidden" name="status" value="no_show" />
                          <button type="submit" className="underline">
                            No-show
                          </button>
                        </form>
                      </>
                    ) : null}
                    {booking.status === "booked" && booking.startAt > now ? (
                      <form action={cancelBookingAction}>
                        <input type="hidden" name="id" value={booking.id} />
                        <button type="submit" className="underline">
                          Cancel
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
