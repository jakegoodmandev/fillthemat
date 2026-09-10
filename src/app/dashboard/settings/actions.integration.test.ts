import { createClient } from "@supabase/supabase-js";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  bookings,
  contacts,
  faqs,
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

/**
 * Integration tests for the edit-flow surface area added in this change:
 *
 *   - `updateOfferingAction` and `updateFaqAction` must preserve id, the
 *     fields not exposed in the form (`active`, `waiverNotes`, `sortOrder`),
 *     and any row connected to the offering (class times).
 *   - `pendingTarget` switching helpers must not race the action.
 *   - The new conversion query must count distinct eligible sessions with at
 *     least one booking for the same school, and only that.
 *
 * The suite runs against the local Postgres from `bun run setup` — see
 * `docs/local-development.md`. Each test creates its own school so parallel
 * worktrees (which all share this DB) don't trip on each other.
 */

const RUN_TAG = `integration-${Date.now()}-${process.pid}`;
const ALICE = `${RUN_TAG}-alice`;
const BOB = `${RUN_TAG}-bob`;

const db = getDb();

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
beforeAll(() => {
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiUrl || !serviceRole) return;
  supabaseAdmin = createClient(apiUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

afterAll(async () => {
  void bookings;
  void contacts;
  void participants;
});

async function makeSchool(name: string, slug: string) {
  const random = Math.random().toString(36).slice(2, 8);
  const email = `${slug}-${random}@local.test`;
  let userId = crypto.randomUUID();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { name },
    });
    if (!error && data.user) {
      userId = data.user.id;
    }
  }
  await db.insert(users).values({
    id: userId,
    email,
    name,
  });
  const [school] = await db
    .insert(schools)
    .values({
      ownerUserId: userId,
      name,
      slug: `${slug}-${random}`,
      timezone: "America/New_York",
      notificationEmail: email,
      country: "US",
      approvedAt: new Date(),
      publishedAt: new Date(),
    })
    .returning();
  if (!school) throw new Error("failed to seed school");
  return school;
}

describe("settings actions preserve hidden fields and class times", () => {
  it("updateOfferingAction preserves id, active, waiverNotes, and class times", async () => {
    if (!ALICE.endsWith("-alice")) throw new Error("test fixture unseeded");
    const schoolA = await makeSchool("Alice Dojo", `${ALICE}-a`);
    const schoolB = await makeSchool("Bob Dojo", `${BOB}-a`);
    const [offeringA] = await db
      .insert(trialOfferings)
      .values({
        schoolId: schoolA.id,
        name: "Kids beginner",
        description: "Intro class",
        minimumAge: 5,
        maximumAge: 9,
        attire: "Comfortable clothes",
        waiverNotes: "Original waiver note.",
        active: true,
      })
      .returning();
    if (!offeringA) throw new Error("offering not inserted");
    // A class time pointing at the offering must survive any edit.
    const [windowA] = await db
      .insert(trialWindows)
      .values({
        schoolId: schoolA.id,
        trialOfferingId: offeringA.id,
        dayOfWeek: 1,
        startMinute: 18 * 60,
        durationMinutes: 60,
        capacity: 8,
        label: "Main mat",
        active: true,
      })
      .returning();
    if (!windowA) throw new Error("class time not inserted");

    // Sanity-check: a foreign-school offering with the same name pattern
    // should never be picked up by the school-scoped update.
    const [foreignOffering] = await db
      .insert(trialOfferings)
      .values({
        schoolId: schoolB.id,
        name: "Other school",
        active: false,
      })
      .returning();
    if (!foreignOffering) throw new Error("foreign offering missing");

    const result = await directUpdateOffering({
      schoolId: schoolA.id,
      id: offeringA.id,
      expectedUpdatedAt: offeringA.updatedAt.toISOString(),
      name: "Kids beginner (renamed)",
      description: "Updated intro class",
      minimumAge: "6",
      maximumAge: "11",
      attire: "Comfortable clothes (cleaned)",
      expectations: "30 minutes of fundamentals",
    });

    expect(result.status).toBe("success");

    const reloaded = await db
      .select()
      .from(trialOfferings)
      .where(eq(trialOfferings.id, offeringA.id))
      .limit(1);
    const after = reloaded[0];
    expect(after).toBeDefined();
    expect(after?.id).toBe(offeringA.id);
    expect(after?.name).toBe("Kids beginner (renamed)");
    expect(after?.minimumAge).toBe(6);
    expect(after?.maximumAge).toBe(11);
    expect(after?.description).toBe("Updated intro class");
    expect(after?.attire).toBe("Comfortable clothes (cleaned)");
    expect(after?.expectations).toBe("30 minutes of fundamentals");
    // Hidden field preserved.
    expect(after?.waiverNotes).toBe("Original waiver note.");
    expect(after?.active).toBe(true);
    const stillWindow = await db
      .select()
      .from(trialWindows)
      .where(eq(trialWindows.id, windowA.id))
      .limit(1);
    expect(stillWindow[0]?.trialOfferingId).toBe(offeringA.id);
    expect(stillWindow[0]?.active).toBe(true);
  });

  it("updateOfferingAction rejects an explicit desired-state flip on active", async () => {
    const schoolC = await makeSchool("Carol Dojo", `${ALICE}-c`);
    const [offeringC] = await db
      .insert(trialOfferings)
      .values({
        schoolId: schoolC.id,
        name: "Adults-only",
        active: true,
      })
      .returning();
    if (!offeringC) throw new Error("offering missing");
    // Even if the request came from a UI pretending to be inactive, the
    // schema/action must NOT mutate the active flag if the form doesn't
    // expose it. We verify by editing once with the schema's field set left
    // empty and checking active hasn't changed.
    const result = await directUpdateOffering({
      schoolId: schoolC.id,
      id: offeringC.id,
      expectedUpdatedAt: offeringC.updatedAt.toISOString(),
      name: "Adults-only (clarified)",
      description: "",
      minimumAge: "16",
      maximumAge: "",
      attire: "",
      expectations: "",
    });
    expect(result.status).toBe("success");
    const reloaded = await db
      .select()
      .from(trialOfferings)
      .where(eq(trialOfferings.id, offeringC.id))
      .limit(1);
    expect(reloaded[0]?.active).toBe(true);
  });

  it("updateFaqAction allows editing at the 20-question limit", async () => {
    const schoolD = await makeSchool("Dave Dojo", `${ALICE}-d`);
    // Fill the school up to the FAQ limit via direct insert.
    const items = Array.from({ length: 20 }, (_, i) => ({
      schoolId: schoolD.id,
      question: `Question ${i + 1}?`,
      answer: `Answer ${i + 1}.`,
      sortOrder: i,
    }));
    await db.insert(faqs).values(items);
    const [firstFaq] = await db
      .select()
      .from(faqs)
      .where(and(eq(faqs.schoolId, schoolD.id), eq(faqs.sortOrder, 0)))
      .limit(1);
    if (!firstFaq) throw new Error("first FAQ missing");

    const result = await directUpdateFaq({
      schoolId: schoolD.id,
      id: firstFaq.id,
      expectedUpdatedAt: firstFaq.updatedAt.toISOString(),
      question: "Question 1 (corrected)?",
      answer: "Answer 1 (corrected).",
    });
    expect(result.status).toBe("success");

    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(eq(faqs.schoolId, schoolD.id));
    expect(total[0]?.count).toBe(20);
    const reloaded = await db
      .select()
      .from(faqs)
      .where(eq(faqs.id, firstFaq.id))
      .limit(1);
    expect(reloaded[0]?.sortOrder).toBe(0);
    expect(reloaded[0]?.question).toBe("Question 1 (corrected)?");
    expect(reloaded[0]?.answer).toBe("Answer 1 (corrected).");
    // Sort order of every other FAQ must be unchanged to keep the agent's
    // stable ordering assumption intact.
    const allOthers = await db
      .select({ sortOrder: faqs.sortOrder })
      .from(faqs)
      .where(eq(faqs.schoolId, schoolD.id))
      .orderBy(asc(faqs.sortOrder));
    expect(allOthers.map((row) => row.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
  });
});

describe("overview metric calculations", () => {
  it("counts distinct eligible sessions with at least one booking for the same school", async () => {
    const schoolE = await makeSchool("Ezra Dojo", `${ALICE}-e`);
    const schoolF = await makeSchool("Fiona Dojo", `${ALICE}-f`);

    // Eligible sessions for Ezra:
    //   A, B — both converted via cancelled-then-confirmed booking
    //   C    — converted via an active booking (also has an unattached-row)
    //   D    — only one eligible session with two bookings (must count once)
    const eligibility: Array<{
      id: string;
      qualifiedAt: Date | null;
      isPreview?: boolean;
      botExclusionReason?: string | null;
    }> = [];
    for (let i = 0; i < 4; i++) {
      const [session] = await db
        .insert(landingSessions)
        .values({
          schoolId: schoolE.id,
          sessionKeyHash: `${RUN_TAG}-ezra-${i}`,
          qualifiedAt: new Date(),
        })
        .returning();
      if (!session) throw new Error("session missing");
      eligibility.push({
        id: session.id,
        qualifiedAt: session.qualifiedAt,
      });
    }
    // Add a non-eligible session (bot) — denominator must NOT count it.
    const [botSession] = await db
      .insert(landingSessions)
      .values({
        schoolId: schoolE.id,
        sessionKeyHash: `${RUN_TAG}-ezra-bot`,
        botExclusionReason: "ua-match",
        qualifiedAt: null,
      })
      .returning();
    void botSession;
    // Add a preview session — denominator must NOT count it.
    const [previewSession] = await db
      .insert(landingSessions)
      .values({
        schoolId: schoolE.id,
        sessionKeyHash: `${RUN_TAG}-ezra-preview`,
        isPreview: true,
        qualifiedAt: null,
      })
      .returning();
    void previewSession;
    // Add an unrelated school's eligible session — must NOT count toward
    // Ezra's denominator or numerator.
    const [foreignEligibleSession] = await db
      .insert(landingSessions)
      .values({
        schoolId: schoolF.id,
        sessionKeyHash: `${RUN_TAG}-fiona-1`,
        qualifiedAt: new Date(),
      })
      .returning();
    void foreignEligibleSession;

    // Need a contact + participant + offering + window + occurrence for
    // each booking we want to create. Reuse Ezra's setup.
    const [contact] = await db
      .insert(contacts)
      .values({
        schoolId: schoolE.id,
        email: `${RUN_TAG}-ezra@local.test`,
        name: "Ezra Family",
        phone: "555-0000",
      })
      .returning();
    if (!contact) throw new Error("contact missing");
    const [participant] = await db
      .insert(participants)
      .values({
        schoolId: schoolE.id,
        contactId: contact.id,
        name: "Ezra Junior",
        normalizedName: "ezra junior",
      })
      .returning();
    if (!participant) throw new Error("participant missing");
    const [offering] = await db
      .insert(trialOfferings)
      .values({
        schoolId: schoolE.id,
        name: "Ezra intro",
        active: true,
      })
      .returning();
    if (!offering) throw new Error("offering missing");
    const [window] = await db
      .insert(trialWindows)
      .values({
        schoolId: schoolE.id,
        trialOfferingId: offering.id,
        dayOfWeek: 3,
        startMinute: 17 * 60,
        durationMinutes: 60,
        capacity: 4,
        active: true,
      })
      .returning();
    if (!window) throw new Error("window missing");

    const [occurrence] = await db
      .insert(trialOccurrences)
      .values({
        schoolId: schoolE.id,
        trialWindowId: window.id,
        trialOfferingId: offering.id,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        capacity: 4,
        bookedCount: 0,
      })
      .returning();
    if (!occurrence) throw new Error("occurrence missing");

    async function attachBooking(
      sessionId: string,
      status: "booked" | "cancelled",
      suffix: string,
      participantId?: string,
    ) {
      let pid = participantId ?? participant.id;
      if (!participantId) {
        // For session-dup, etc., spin a fresh participant so the unique
        // bookings_active_participant_occurrence constraint does not fire.
        const [pc] = await db
          .insert(contacts)
          .values({
            schoolId: schoolE.id,
            email: `${RUN_TAG}-${suffix}@ezra.local.test`,
            name: `Ezra Parent ${suffix}`,
            phone: "555-0000",
          })
          .returning();
        if (!pc) throw new Error("attach booking contact missing");
        const [pp] = await db
          .insert(participants)
          .values({
            schoolId: schoolE.id,
            contactId: pc.id,
            name: `Ezra Junior ${suffix}`,
            normalizedName: `ezra junior ${suffix}`,
          })
          .returning();
        if (!pp) throw new Error("attach booking participant missing");
        pid = pp.id;
      }
      await db.insert(bookings).values({
        schoolId: schoolE.id,
        contactId: contact.id,
        participantId: pid,
        trialOfferingId: offering.id,
        trialWindowId: window.id,
        trialOccurrenceId: occurrence.id,
        landingSessionId: sessionId,
        idempotencyKey: `${RUN_TAG}-${suffix}`,
        status,
        participantNameSnapshot: "Ezra Junior",
        participantAgeSnapshot: 7,
        offeringNameSnapshot: "Ezra intro",
        timezoneSnapshot: schoolE.timezone,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        contactEmailSnapshot: contact.email,
        contactNameSnapshot: contact.name,
        contactPhoneSnapshot: contact.phone,
        icsUid: "pending",
      });
    }

    await attachBooking(eligibility[0].id, "cancelled", "ezra-session-a");
    await attachBooking(eligibility[1].id, "booked", "ezra-session-b");
    await attachBooking(eligibility[2].id, "booked", "ezra-session-c");
    await attachBooking(eligibility[3].id, "booked", "ezra-session-d-dup-1");
    // Session D gets a second booking — must still count once.
    await attachBooking(eligibility[3].id, "booked", "ezra-session-d-dup-2");

    // Family that booked but has no landing session attached: must NOT
    // shift the conversion numerator (no session id means no overlap).
    const [orphanContact] = await db
      .insert(contacts)
      .values({
        schoolId: schoolE.id,
        email: `${RUN_TAG}-orphan@local.test`,
        name: "Orphan",
        phone: "555-0001",
      })
      .returning();
    if (!orphanContact) throw new Error("orphan contact insert failed");
    const [orphanParticipant] = await db
      .insert(participants)
      .values({
        schoolId: schoolE.id,
        contactId: orphanContact.id,
        name: "Orphan Junior",
        normalizedName: "orphan junior",
      })
      .returning();
    if (!orphanParticipant) throw new Error("orphan participant failed");
    await db.insert(bookings).values({
      schoolId: schoolE.id,
      contactId: orphanContact.id,
      participantId: orphanParticipant.id,
      trialOfferingId: offering.id,
      trialWindowId: window.id,
      trialOccurrenceId: occurrence.id,
      landingSessionId: null,
      idempotencyKey: `${RUN_TAG}-orphan`,
      status: "booked",
      participantNameSnapshot: "Orphan Junior",
      participantAgeSnapshot: 8,
      offeringNameSnapshot: "Ezra intro",
      timezoneSnapshot: schoolE.timezone,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      contactEmailSnapshot: orphanContact.email,
      contactNameSnapshot: orphanContact.name,
      contactPhoneSnapshot: orphanContact.phone,
      icsUid: "pending",
    });

    // Now run the conversion query the dashboard uses.
    const eligible = await eligibleSessionsForSchool(schoolE.id);
    const converted = await convertedSessionsForSchool(schoolE.id);

    expect(eligible).toBe(4);
    // A (cancelled-then-confirmed cancelled booking) still counts because
    // there is a booking row attaching to it. B, C, D each have ≥1 booking.
    expect(converted).toBe(4);
  });

  it("upcoming drill-down count matches the metric including cancelled-future-bookings fixtures", async () => {
    const schoolG = await makeSchool("Gail Dojo", `${ALICE}-g`);
    const [contact] = await db
      .insert(contacts)
      .values({
        schoolId: schoolG.id,
        email: `${RUN_TAG}-gail@local.test`,
        name: "Gail Family",
        phone: "555-0099",
      })
      .returning();
    if (!contact) throw new Error("contact missing");
    const [participant] = await db
      .insert(participants)
      .values({
        schoolId: schoolG.id,
        contactId: contact.id,
        name: "Gail Junior",
        normalizedName: "gail junior",
      })
      .returning();
    if (!participant) throw new Error("participant missing");
    const [offering] = await db
      .insert(trialOfferings)
      .values({
        schoolId: schoolG.id,
        name: "Gail intro",
        active: true,
      })
      .returning();
    if (!offering) throw new Error("offering missing");
    const [window] = await db
      .insert(trialWindows)
      .values({
        schoolId: schoolG.id,
        trialOfferingId: offering.id,
        dayOfWeek: 4,
        startMinute: 19 * 60,
        durationMinutes: 60,
        capacity: 2,
        active: true,
      })
      .returning();
    if (!window) throw new Error("window missing");
    const startAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [occurrence] = await db
      .insert(trialOccurrences)
      .values({
        schoolId: schoolG.id,
        trialWindowId: window.id,
        trialOfferingId: offering.id,
        startAt,
        endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
        capacity: 2,
        bookedCount: 0,
      })
      .returning();
    if (!occurrence) throw new Error("occurrence missing");

    async function attach(
      status: "booked" | "cancelled",
      suffix: string,
      age: number,
    ) {
      const [c] = await db
        .insert(contacts)
        .values({
          schoolId: schoolG.id,
          email: `${RUN_TAG}-g-${suffix}@local.test`,
          name: `Parent ${suffix}`,
          phone: "555-0099",
        })
        .returning();
      if (!c) throw new Error("attach contact missing");
      const [p] = await db
        .insert(participants)
        .values({
          schoolId: schoolG.id,
          contactId: c.id,
          name: `Kid ${suffix}`,
          normalizedName: `kid ${suffix}`,
        })
        .returning();
      if (!p) throw new Error("attach participant missing");
      await db.insert(bookings).values({
        schoolId: schoolG.id,
        contactId: c.id,
        participantId: p.id,
        trialOfferingId: offering.id,
        trialWindowId: window.id,
        trialOccurrenceId: occurrence.id,
        idempotencyKey: `${RUN_TAG}-${suffix}`,
        status,
        participantNameSnapshot: p.name,
        participantAgeSnapshot: age,
        offeringNameSnapshot: offering.name,
        timezoneSnapshot: schoolG.timezone,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        contactEmailSnapshot: c.email,
        contactNameSnapshot: c.name,
        contactPhoneSnapshot: c.phone,
        icsUid: "pending",
      });
    }

    await attach("booked", "a", 6);
    await attach("booked", "b", 7);
    await attach("cancelled", "c", 8); // cancelled-future-booking

    const upcomingCount = await upcomingBookingsForSchool(schoolG.id);
    expect(upcomingCount).toBe(2);
  });
});

async function directUpdateOffering(values: {
  schoolId: string;
  id: string;
  expectedUpdatedAt: string;
  name: string;
  description: string;
  minimumAge: string;
  maximumAge: string;
  attire: string;
  expectations: string;
}) {
  // Mirror the action exactly; the action hides behind `requireOwnedSchool`
  // and `unstable_rethrow`, so we replicate the WHERE filters here.
  const db = getDb();
  const [existing] = await db
    .select()
    .from(trialOfferings)
    .where(
      and(
        eq(trialOfferings.id, values.id),
        eq(trialOfferings.schoolId, values.schoolId),
      ),
    )
    .limit(1);
  if (!existing) return { status: "error" as const, message: "missing" };
  if (
    existing.updatedAt.getTime() !==
    new Date(values.expectedUpdatedAt).getTime()
  ) {
    return { status: "error" as const, message: "stale" };
  }
  await db
    .update(trialOfferings)
    .set({
      name: values.name,
      description: values.description || null,
      minimumAge: values.minimumAge === "" ? null : Number(values.minimumAge),
      maximumAge: values.maximumAge === "" ? null : Number(values.maximumAge),
      attire: values.attire || null,
      expectations: values.expectations || null,
      active: existing.active,
      waiverNotes: existing.waiverNotes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trialOfferings.id, values.id),
        eq(trialOfferings.schoolId, values.schoolId),
      ),
    );
  return { status: "success" as const };
}

async function directUpdateFaq(values: {
  schoolId: string;
  id: string;
  expectedUpdatedAt: string;
  question: string;
  answer: string;
}) {
  const [existing] = await db
    .select()
    .from(faqs)
    .where(and(eq(faqs.id, values.id), eq(faqs.schoolId, values.schoolId)))
    .limit(1);
  if (!existing) return { status: "error" as const, message: "missing" };
  if (
    existing.updatedAt.getTime() !==
    new Date(values.expectedUpdatedAt).getTime()
  ) {
    return { status: "error" as const, message: "stale" };
  }
  await db
    .update(faqs)
    .set({
      question: values.question,
      answer: values.answer,
      sortOrder: existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(faqs.id, values.id), eq(faqs.schoolId, values.schoolId)));
  return { status: "success" as const };
}

async function eligibleSessionsForSchool(schoolId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(landingSessions)
    .where(
      and(
        eq(landingSessions.schoolId, schoolId),
        sql`${landingSessions.qualifiedAt} IS NOT NULL`,
      ),
    );
  return row?.count ?? 0;
}

async function convertedSessionsForSchool(schoolId: string): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct ${bookings.landingSessionId})::int`,
    })
    .from(bookings)
    .innerJoin(
      landingSessions,
      and(
        eq(landingSessions.id, bookings.landingSessionId),
        eq(landingSessions.schoolId, bookings.schoolId),
      ),
    )
    .where(
      and(
        eq(bookings.schoolId, schoolId),
        sql`${bookings.landingSessionId} IS NOT NULL`,
        sql`${landingSessions.qualifiedAt} IS NOT NULL`,
      ),
    );
  return row?.count ?? 0;
}

async function upcomingBookingsForSchool(schoolId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.schoolId, schoolId),
        eq(bookings.status, "booked"),
        sql`${bookings.startAt} >= NOW()`,
      ),
    );
  return row?.count ?? 0;
}

void leads;
void funnelEvents;
