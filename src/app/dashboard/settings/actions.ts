"use server";

import { and, eq, gt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  bookings,
  faqs,
  schools,
  trialOccurrences,
  trialOfferings,
  trialWindows,
} from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { isValidSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";
import { emailSchema, optionalText } from "@/lib/validation";

function emptyToNull(
  value: FormDataEntryValue | null,
  max: number,
): string | null {
  const parsed = optionalText(max).safeParse(String(value ?? ""));
  return parsed.success ? parsed.data : null;
}

export async function updateProfileAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "");
  const notificationEmail = emailSchema.safeParse(
    formData.get("notificationEmail"),
  );
  if (!name || !notificationEmail.success) return;

  const published = school.publishedAt != null;
  if (!published) {
    if (!isValidSlug(slug) || !isValidTimezone(timezone)) return;
  }

  await db
    .update(schools)
    .set({
      name,
      slug: published ? school.slug : slug,
      timezone: published ? school.timezone : timezone,
      notificationEmail: notificationEmail.data,
      phone: emptyToNull(formData.get("phone"), 32),
      website: emptyToNull(formData.get("website"), 2048),
      address: emptyToNull(formData.get("address"), 500),
      city: emptyToNull(formData.get("city"), 80),
      country: emptyToNull(formData.get("country"), 2) ?? "US",
      parkingNotes: emptyToNull(formData.get("parkingNotes"), 2000),
      accessNotes: emptyToNull(formData.get("accessNotes"), 2000),
      trialGuidance: emptyToNull(formData.get("trialGuidance"), 2000),
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));
  revalidatePath("/dashboard/settings");
}

export async function updatePricingAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  await db
    .update(schools)
    .set({
      pricing: emptyToNull(formData.get("pricing"), 4000),
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));
  revalidatePath("/dashboard/settings");
}

export async function updateAgentAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  await db
    .update(schools)
    .set({
      welcomeMessage: emptyToNull(formData.get("welcomeMessage"), 1000),
      agentInstructions: emptyToNull(formData.get("agentInstructions"), 2000),
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));
  revalidatePath("/dashboard/settings");
}

export async function updateBrandingAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const logoUrl = emptyToNull(formData.get("logoUrl"), 2048);
  const primaryColor = emptyToNull(formData.get("primaryColor"), 7);
  if (logoUrl && !logoUrl.startsWith("https://")) return;
  if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) return;
  const db = getDb();
  await db
    .update(schools)
    .set({ logoUrl, primaryColor, updatedAt: new Date() })
    .where(eq(schools.id, school.id));
  revalidatePath("/dashboard/settings");
}

export async function createOfferingAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const min = formData.get("minimumAge");
  const max = formData.get("maximumAge");
  const db = getDb();
  await db.insert(trialOfferings).values({
    schoolId: school.id,
    name,
    description: emptyToNull(formData.get("description"), 2000),
    minimumAge: min ? Number(min) : null,
    maximumAge: max ? Number(max) : null,
    expectations: emptyToNull(formData.get("expectations"), 2000),
    attire: emptyToNull(formData.get("attire"), 1000),
    waiverNotes: emptyToNull(formData.get("waiverNotes"), 1000),
    active: true,
  });
  revalidatePath("/dashboard/settings");
}

export async function toggleOfferingAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active")) === "true";
  const db = getDb();
  await db
    .update(trialOfferings)
    .set({ active: !active, updatedAt: new Date() })
    .where(
      and(eq(trialOfferings.id, id), eq(trialOfferings.schoolId, school.id)),
    );
  revalidatePath("/dashboard/settings");
}

export async function createWindowAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  await db.insert(trialWindows).values({
    schoolId: school.id,
    trialOfferingId: String(formData.get("trialOfferingId")),
    dayOfWeek: Number(formData.get("dayOfWeek")),
    startMinute:
      Number(formData.get("startHour")) * 60 +
      Number(formData.get("startMinute")),
    durationMinutes: Number(formData.get("durationMinutes")),
    capacity: Number(formData.get("capacity")),
    label: emptyToNull(formData.get("label"), 80),
    active: true,
  });
  revalidatePath("/dashboard/settings");
}

export async function deactivateWindowAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const id = String(formData.get("id") ?? "");
  const db = getDb();
  await db
    .update(trialWindows)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)));
  revalidatePath("/dashboard/settings");
}

export async function updateWindowCapacityAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const id = String(formData.get("id") ?? "");
  const capacity = Number(formData.get("capacity"));
  if (capacity < 1 || capacity > 50) return;
  const db = getDb();
  const [maxBooked] = await db
    .select({
      max: sql<number>`coalesce(max(${trialOccurrences.bookedCount}), 0)::int`,
    })
    .from(trialOccurrences)
    .where(
      and(
        eq(trialOccurrences.schoolId, school.id),
        eq(trialOccurrences.trialWindowId, id),
        gt(trialOccurrences.startAt, new Date()),
      ),
    );
  if ((maxBooked?.max ?? 0) > capacity) return;

  await db
    .update(trialWindows)
    .set({ capacity, updatedAt: new Date() })
    .where(and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)));
  await db
    .update(trialOccurrences)
    .set({ capacity, updatedAt: new Date() })
    .where(
      and(
        eq(trialOccurrences.schoolId, school.id),
        eq(trialOccurrences.trialWindowId, id),
        gt(trialOccurrences.startAt, new Date()),
        sql`${trialOccurrences.bookedCount} <= ${capacity}`,
      ),
    );
  revalidatePath("/dashboard/settings");
}

export async function deleteWindowAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const id = String(formData.get("id") ?? "");
  const db = getDb();
  const [occurrence] = await db
    .select({ id: trialOccurrences.id })
    .from(trialOccurrences)
    .where(
      and(
        eq(trialOccurrences.schoolId, school.id),
        eq(trialOccurrences.trialWindowId, id),
      ),
    )
    .limit(1);
  if (occurrence) return;
  await db
    .delete(trialWindows)
    .where(and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)));
  revalidatePath("/dashboard/settings");
}

export async function createFaqAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  if (!question || !answer) return;
  const db = getDb();
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(faqs)
    .where(eq(faqs.schoolId, school.id));
  if ((existing[0]?.count ?? 0) >= 20) return;
  await db.insert(faqs).values({
    schoolId: school.id,
    question,
    answer,
    sortOrder: existing[0]?.count ?? 0,
  });
  revalidatePath("/dashboard/settings");
}

export async function deleteFaqAction(formData: FormData) {
  const { school } = await requireOwnedSchool();
  const id = String(formData.get("id") ?? "");
  const db = getDb();
  await db
    .delete(faqs)
    .where(and(eq(faqs.id, id), eq(faqs.schoolId, school.id)));
  revalidatePath("/dashboard/settings");
}

export async function windowHasFutureBooking(
  schoolId: string,
  windowId: string,
) {
  const db = getDb();
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.schoolId, schoolId),
        eq(bookings.trialWindowId, windowId),
        ne(bookings.status, "cancelled"),
        gt(bookings.startAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
}
