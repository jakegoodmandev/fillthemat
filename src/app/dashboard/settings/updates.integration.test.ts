import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  faqs,
  schools,
  trialOfferings,
  trialWindows,
  users,
} from "@/db/schema";
import { applyFaqUpdate, applyOfferingUpdate } from "./updates";

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

async function createSchool(tag: string): Promise<string> {
  const userId = randomUUID();
  const schoolId = randomUUID();
  createdUsers.push(userId);
  await db.execute(
    sql`insert into auth.users (id, email, created_at, updated_at) values (${userId}, ${`${userId}@integration.test`}, now(), now())`,
  );
  await db.insert(users).values({
    id: userId,
    email: `${userId}@integration.test`,
    name: `Owner ${tag}`,
  });
  await db.insert(schools).values({
    id: schoolId,
    ownerUserId: userId,
    slug: `${tag.toLowerCase()}-${randomUUID().slice(0, 8)}`,
    name: `School ${tag}`,
    timezone: "America/New_York",
    notificationEmail: `${userId}@integration.test`,
    country: "US",
  });
  return schoolId;
}

afterAll(async () => {
  for (const id of createdUsers) {
    await db.execute(sql`delete from auth.users where id = ${id}`);
  }
});

describe.runIf(hasDatabase)("settings updates", () => {
  it("edits an offering in place, preserving active, waiverNotes, and class-time association, and rejects a stale token", async () => {
    const schoolId = await createSchool("upd");
    const offeringId = randomUUID();
    const windowId = randomUUID();
    await db.insert(trialOfferings).values({
      id: offeringId,
      schoolId,
      name: "Old name",
      description: "Old description",
      minimumAge: 5,
      maximumAge: 10,
      attire: "Old attire",
      expectations: "Old expectations",
      waiverNotes: "Waiver must be signed",
      active: false,
    });
    await db.insert(trialWindows).values({
      id: windowId,
      schoolId,
      trialOfferingId: offeringId,
      dayOfWeek: 2,
      startMinute: 600,
      durationMinutes: 60,
      capacity: 8,
      active: true,
    });

    const [before] = await db
      .select()
      .from(trialOfferings)
      .where(eq(trialOfferings.id, offeringId));
    if (!before) throw new Error("offering not created");

    const result = await applyOfferingUpdate(db, {
      schoolId,
      id: offeringId,
      token: before.updatedAt,
      values: {
        name: "New name",
        description: "New description",
        minimumAge: 6,
        maximumAge: 12,
        attire: "New attire",
        expectations: "New expectations",
      },
    });
    expect(result).toEqual({ ok: true });

    const [after] = await db
      .select()
      .from(trialOfferings)
      .where(eq(trialOfferings.id, offeringId));
    if (!after) throw new Error("offering vanished after update");

    // Same identity, supported fields updated.
    expect(after.id).toBe(offeringId);
    expect(after.name).toBe("New name");
    expect(after.description).toBe("New description");
    expect(after.minimumAge).toBe(6);
    expect(after.maximumAge).toBe(12);
    expect(after.attire).toBe("New attire");
    expect(after.expectations).toBe("New expectations");
    // Hidden data untouched.
    expect(after.waiverNotes).toBe("Waiver must be signed");
    expect(after.active).toBe(false);

    // Class-time association remains on the same id.
    const [window] = await db
      .select()
      .from(trialWindows)
      .where(eq(trialWindows.id, windowId));
    expect(window?.trialOfferingId).toBe(offeringId);

    // A stale token must not overwrite.
    const stale = await applyOfferingUpdate(db, {
      schoolId,
      id: offeringId,
      token: new Date(before.updatedAt.getTime() - 1000),
      values: {
        name: "Stale overwrite",
        description: null,
        minimumAge: null,
        maximumAge: null,
        attire: null,
        expectations: null,
      },
    });
    expect(stale).toEqual({ ok: false, reason: "conflict" });

    const [afterStale] = await db
      .select({ name: trialOfferings.name })
      .from(trialOfferings)
      .where(eq(trialOfferings.id, offeringId));
    expect(afterStale?.name).toBe("New name");
  });

  it("edits a FAQ at the limit without deleting the row or changing its sort order", async () => {
    const schoolId = await createSchool("faq");
    const ids: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      ids.push(randomUUID());
    }
    await db.insert(faqs).values(
      ids.map((id, index) => ({
        id,
        schoolId,
        question: `Question ${index}`,
        answer: `Answer ${index}`,
        sortOrder: index,
      })),
    );

    const editedId = ids[7];
    const [before] = await db.select().from(faqs).where(eq(faqs.id, editedId));
    if (!before) throw new Error("faq not created");

    const result = await applyFaqUpdate(db, {
      schoolId,
      id: editedId,
      token: before.updatedAt,
      values: { question: "Question 7 edited", answer: "Answer 7 edited" },
    });
    expect(result).toEqual({ ok: true });

    const [after] = await db.select().from(faqs).where(eq(faqs.id, editedId));
    expect(after?.id).toBe(editedId);
    expect(after?.question).toBe("Question 7 edited");
    expect(after?.answer).toBe("Answer 7 edited");
    expect(after?.sortOrder).toBe(7);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(eq(faqs.schoolId, schoolId));
    expect(countRow?.count).toBe(20);
  });
});
