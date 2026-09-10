import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { and, eq, gte, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  bookings,
  contacts,
  emailDeliveries,
  funnelEvents,
  landingSessions,
  leads,
  participants,
  schools,
  trialOccurrences,
  trialOfferings,
  trialWindows,
  users,
} from "@/db/schema";
import { FUNNEL_EVENTS } from "@/lib/funnel";
import { loadOverviewMetrics } from "./queries";

// The integration config does not load .env.local; do it before getDb() opens
// its first connection.
if (!process.env.DATABASE_URL) {
  const raw = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const parsed = parseEnv(raw);
  process.env.DATABASE_URL = parsed.DATABASE_URL ?? "";
}
const hasDatabase = process.env.DATABASE_URL.length > 0;

const db = getDb();
const createdUsers: string[] = [];

function randomSlug(tag: string): string {
  const safe = tag.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `${safe.slice(0, 20)}-${randomUUID().slice(0, 8)}`;
}

async function createSchool(
  tag: string,
  opts: { published?: boolean } = {},
): Promise<{ userId: string; schoolId: string }> {
  const userId = randomUUID();
  const schoolId = randomUUID();
  const email = `${userId}@integration.test`;
  createdUsers.push(userId);
  // `app.users.id` is a FK to `auth.users.id`; satisfy it with a raw row so the
  // test does not depend on the Supabase Admin API.
  await db.execute(
    sql`insert into auth.users (id, email, created_at, updated_at) values (${userId}, ${email}, now(), now())`,
  );
  await db.insert(users).values({
    id: userId,
    email,
    name: `Owner ${tag}`,
  });
  await db.insert(schools).values({
    id: schoolId,
    ownerUserId: userId,
    slug: randomSlug(tag),
    name: `School ${tag}`,
    timezone: "America/New_York",
    notificationEmail: `${userId}@integration.test`,
    country: "US",
    approvedAt: opts.published ? new Date() : null,
    publishedAt: opts.published ? new Date() : null,
  });
  return { userId, schoolId };
}

type Catalog = {
  offeringId: string;
  windowId: string;
  occurrenceId: string;
  contactId: string;
  occurrenceStartAt: Date;
};

async function createCatalog(schoolId: string): Promise<Catalog> {
  const offeringId = randomUUID();
  const windowId = randomUUID();
  const occurrenceId = randomUUID();
  const contactId = randomUUID();
  const occurrenceStartAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(trialOfferings).values({
    id: offeringId,
    schoolId,
    name: "Kids trial",
    active: true,
  });
  await db.insert(trialWindows).values({
    id: windowId,
    schoolId,
    trialOfferingId: offeringId,
    dayOfWeek: 1,
    startMinute: 18 * 60,
    durationMinutes: 60,
    capacity: 8,
    active: true,
  });
  await db.insert(trialOccurrences).values({
    id: occurrenceId,
    schoolId,
    trialWindowId: windowId,
    trialOfferingId: offeringId,
    startAt: occurrenceStartAt,
    endAt: new Date(occurrenceStartAt.getTime() + 60 * 60 * 1000),
    capacity: 8,
    bookedCount: 0,
  });
  await db.insert(contacts).values({
    id: contactId,
    schoolId,
    email: `${randomUUID()}@integration.test`,
    name: "Parent",
    phone: "555-0100",
  });

  return { offeringId, windowId, occurrenceId, contactId, occurrenceStartAt };
}

async function createParticipant(
  schoolId: string,
  contactId: string,
  name: string,
): Promise<string> {
  const id = randomUUID();
  await db.insert(participants).values({
    id,
    schoolId,
    contactId,
    name,
    normalizedName: name.toLowerCase(),
  });
  return id;
}

async function createSession(
  schoolId: string,
  opts: { qualified?: boolean; preview?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await db.insert(landingSessions).values({
    id,
    schoolId,
    sessionKeyHash: `integration-${randomUUID()}`,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    qualifiedAt: opts.qualified ? new Date() : null,
    isPreview: opts.preview ?? false,
    botExclusionReason: null,
  });
  return id;
}

async function createBooking(
  schoolId: string,
  catalog: Catalog,
  opts: {
    participantId: string;
    landingSessionId?: string | null;
    status?: "booked" | "cancelled";
    startAt: Date;
  },
): Promise<string> {
  const id = randomUUID();
  await db.insert(bookings).values({
    id,
    schoolId,
    contactId: catalog.contactId,
    participantId: opts.participantId,
    trialOfferingId: catalog.offeringId,
    trialWindowId: catalog.windowId,
    trialOccurrenceId: catalog.occurrenceId,
    landingSessionId: opts.landingSessionId ?? null,
    idempotencyKey: randomUUID(),
    status: opts.status ?? "booked",
    participantNameSnapshot: "Sam",
    participantAgeSnapshot: 8,
    offeringNameSnapshot: "Kids trial",
    timezoneSnapshot: "America/New_York",
    startAt: opts.startAt,
    endAt: new Date(opts.startAt.getTime() + 60 * 60 * 1000),
    contactEmailSnapshot: "parent@integration.test",
    contactNameSnapshot: "Parent",
    contactPhoneSnapshot: "555-0100",
    icsUid: randomUUID(),
    icsSequence: 0,
  });
  return id;
}

afterAll(async () => {
  // Deleting the auth user cascades through app.users to the school and children.
  for (const id of createdUsers) {
    await db.execute(sql`delete from auth.users where id = ${id}`);
  }
});

describe.runIf(hasDatabase)("loadOverviewMetrics", () => {
  it("computes conversion with duplicate, cancelled, no-session, and unqualified fixtures, scoped per school", async () => {
    const now = new Date();
    const a = await createSchool("a", { published: true });
    const b = await createSchool("b", { published: true });
    const catalogA = await createCatalog(a.schoolId);

    // Sessions: three qualified (q1, q2, q3), one unqualified (u1), and one
    // preview session.
    const q1 = await createSession(a.schoolId, { qualified: true });
    const q2 = await createSession(a.schoolId, { qualified: true });
    const q3 = await createSession(a.schoolId, { qualified: true });
    const u1 = await createSession(a.schoolId, { qualified: false });
    await createSession(a.schoolId, { preview: true });

    const p1 = await createParticipant(a.schoolId, catalogA.contactId, "p1");
    const p2 = await createParticipant(a.schoolId, catalogA.contactId, "p2");
    const p3 = await createParticipant(a.schoolId, catalogA.contactId, "p3");
    const p4 = await createParticipant(a.schoolId, catalogA.contactId, "p4");
    const p5 = await createParticipant(a.schoolId, catalogA.contactId, "p5");

    // Two booked bookings for the same session (duplicate), a cancelled one for
    // another, a booking with no session, one against an unqualified session,
    // and one in the past.
    await createBooking(a.schoolId, catalogA, {
      participantId: p1,
      landingSessionId: q1,
      status: "booked",
      startAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    await createBooking(a.schoolId, catalogA, {
      participantId: p2,
      landingSessionId: q1,
      status: "booked",
      startAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
    });
    await createBooking(a.schoolId, catalogA, {
      participantId: p3,
      landingSessionId: q2,
      status: "cancelled",
      startAt: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
    });
    await createBooking(a.schoolId, catalogA, {
      participantId: p4,
      landingSessionId: null,
      status: "booked",
      startAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    });
    await createBooking(a.schoolId, catalogA, {
      participantId: p5,
      landingSessionId: u1,
      status: "booked",
      startAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    });

    // A lead and emailed failure make the other counters nonzero.
    await db.insert(leads).values({
      id: randomUUID(),
      schoolId: a.schoolId,
      landingSessionId: q3,
      contactId: catalogA.contactId,
      status: "open",
    });
    await db.insert(emailDeliveries).values({
      id: randomUUID(),
      schoolId: a.schoolId,
      kind: "owner_booking",
      recipient: "owner@integration.test",
      providerIdempotencyKey: randomUUID(),
      state: "failed",
      nextAttemptAt: new Date(),
    });
    await db.insert(funnelEvents).values({
      id: randomUUID(),
      schoolId: a.schoolId,
      landingSessionId: q2,
      eventType: FUNNEL_EVENTS.bookingConfirmed,
      metadata: { source: "chat" },
    });

    const metricsA = await loadOverviewMetrics(getDb(), a.schoolId, now);

    // Eligible = 3 qualified sessions; converted = q1 (two bookings, once) and
    // q2 (cancelled still counts). q3 has no booking; u1 is unqualified; the
    // no-session booking is excluded.
    expect(metricsA.eligibleSessions).toBe(3);
    expect(metricsA.convertedSessions).toBe(2);
    expect(metricsA.convertedSessions).toBeLessThanOrEqual(
      metricsA.eligibleSessions,
    );

    // Upcoming = booked + future only: b1, b2, and the no-session booking.
    expect(metricsA.upcomingBookings).toBe(3);
    expect(metricsA.leadCount).toBe(1);
    expect(metricsA.chatBookings).toBe(1);
    expect(metricsA.failedEmailCount).toBe(1);
    expect(metricsA.activeOfferings).toBe(1);
    expect(metricsA.activeWindows).toBe(1);

    // The drill-down filter must reconcile with the metric for the same now.
    const [drill] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.schoolId, a.schoolId),
          eq(bookings.status, "booked"),
          gte(bookings.startAt, now),
        ),
      );
    expect(drill?.count).toBe(metricsA.upcomingBookings);

    // Second school is counted independently.
    const catalogB = await createCatalog(b.schoolId);
    const qb = await createSession(b.schoolId, { qualified: true });
    const pb = await createParticipant(b.schoolId, catalogB.contactId, "pb");
    await createBooking(b.schoolId, catalogB, {
      participantId: pb,
      landingSessionId: qb,
      status: "booked",
      startAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    const metricsB = await loadOverviewMetrics(getDb(), b.schoolId, now);
    expect(metricsB.eligibleSessions).toBe(1);
    expect(metricsB.convertedSessions).toBe(1);
  });

  it("reports a zero denominator for a brand-new school", async () => {
    const now = new Date();
    const { schoolId } = await createSchool("fresh");
    const metrics = await loadOverviewMetrics(getDb(), schoolId, now);
    expect(metrics.eligibleSessions).toBe(0);
    expect(metrics.convertedSessions).toBe(0);
    expect(metrics.upcomingBookings).toBe(0);
    expect(metrics.leadCount).toBe(0);
    expect(metrics.activeOfferings).toBe(0);
    expect(metrics.activeWindows).toBe(0);
    expect(metrics.failedEmailCount).toBe(0);
  });
});
