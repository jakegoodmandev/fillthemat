import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { faqs, trialOfferings } from "@/db/schema";

export type UpdateOutcome =
  | { ok: true }
  | { ok: false; reason: "missing" | "conflict" };

export type OfferingEditValues = {
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  expectations: string | null;
};

/**
 * Atomically update an offering's supported fields. The optimistic-concurrency
 * token is the `updatedAt` the editor loaded; a newer write makes the save
 * return `conflict` instead of silently overwriting. Hidden data (`active`,
 * `waiverNotes`, and class-time associations) is never touched.
 */
export async function applyOfferingUpdate(
  db: Database,
  args: {
    schoolId: string;
    id: string;
    token: Date;
    values: OfferingEditValues;
  },
): Promise<UpdateOutcome> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: trialOfferings.id,
        updatedAt: trialOfferings.updatedAt,
      })
      .from(trialOfferings)
      .where(
        and(
          eq(trialOfferings.id, args.id),
          eq(trialOfferings.schoolId, args.schoolId),
        ),
      )
      .for("update")
      .limit(1);
    if (!existing) return { ok: false, reason: "missing" };
    if (existing.updatedAt.getTime() !== args.token.getTime()) {
      return { ok: false, reason: "conflict" };
    }
    await tx
      .update(trialOfferings)
      .set({
        name: args.values.name,
        description: args.values.description,
        minimumAge: args.values.minimumAge,
        maximumAge: args.values.maximumAge,
        attire: args.values.attire,
        expectations: args.values.expectations,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trialOfferings.id, args.id),
          eq(trialOfferings.schoolId, args.schoolId),
        ),
      );
    return { ok: true };
  });
}

export type FaqEditValues = {
  question: string;
  answer: string;
};

/**
 * Atomically update a FAQ. `id` and `sortOrder` never change; the edit works at
 * the question limit because the limit applies to creating new records only.
 */
export async function applyFaqUpdate(
  db: Database,
  args: {
    schoolId: string;
    id: string;
    token: Date;
    values: FaqEditValues;
  },
): Promise<UpdateOutcome> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: faqs.id, updatedAt: faqs.updatedAt })
      .from(faqs)
      .where(and(eq(faqs.id, args.id), eq(faqs.schoolId, args.schoolId)))
      .for("update")
      .limit(1);
    if (!existing) return { ok: false, reason: "missing" };
    if (existing.updatedAt.getTime() !== args.token.getTime()) {
      return { ok: false, reason: "conflict" };
    }
    await tx
      .update(faqs)
      .set({
        question: args.values.question,
        answer: args.values.answer,
        updatedAt: new Date(),
      })
      .where(and(eq(faqs.id, args.id), eq(faqs.schoolId, args.schoolId)));
    return { ok: true };
  });
}
