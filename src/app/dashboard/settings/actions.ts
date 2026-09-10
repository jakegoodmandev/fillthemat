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
import {
  errorState,
  type SettingsActionState,
  successState,
} from "./action-state";
import {
  capacityBelowBookedMessage,
  parseAgentForm,
  parseBrandingForm,
  parseCapacityForm,
  parseFaqForm,
  parseOfferingForm,
  parsePricingForm,
  parseProfileForm,
  parseRequiredId,
  parseWindowForm,
} from "./parse";

function revalidateSettings() {
  revalidatePath("/dashboard/settings", "layout");
}

const SAVE_FAILED =
  "Something went wrong while saving. Your changes are still in the form. Try again.";

export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const published = school.publishedAt != null;
  const parsed = parseProfileForm(formData, {
    published,
    currentSlug: school.slug,
    currentTimezone: school.timezone,
  });
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);

  const db = getDb();
  if (!published && parsed.data.slug !== school.slug) {
    const [taken] = await db
      .select({ id: schools.id })
      .from(schools)
      .where(and(eq(schools.slug, parsed.data.slug), ne(schools.id, school.id)))
      .limit(1);
    if (taken) {
      return errorState("That public URL is already in use.", {
        slug: "Choose a different public URL.",
      });
    }
  }

  try {
    await db
      .update(schools)
      .set({
        name: parsed.data.name,
        slug: parsed.data.slug,
        timezone: parsed.data.timezone,
        notificationEmail: parsed.data.notificationEmail,
        phone: parsed.data.phone,
        website: parsed.data.website,
        address: parsed.data.address,
        city: parsed.data.city,
        country: parsed.data.country,
        parkingNotes: parsed.data.parkingNotes,
        accessNotes: parsed.data.accessNotes,
        trialGuidance: parsed.data.trialGuidance,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Saved. Your agent can use this now.");
}

export async function updatePricingAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parsePricingForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    await db
      .update(schools)
      .set({
        pricing: parsed.data.pricing,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Saved. Your agent can use this now.");
}

export async function updateAgentAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseAgentForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    await db
      .update(schools)
      .set({
        welcomeMessage: parsed.data.welcomeMessage,
        agentInstructions: parsed.data.agentInstructions,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Saved. Your agent can use this now.");
}

export async function updateBrandingAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseBrandingForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    await db
      .update(schools)
      .set({
        logoUrl: parsed.data.logoUrl,
        primaryColor: parsed.data.primaryColor,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState(
    "Saved. Parents will see this on your trial-booking page.",
  );
}

export async function createOfferingAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseOfferingForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    await db.insert(trialOfferings).values({
      schoolId: school.id,
      name: parsed.data.name,
      description: parsed.data.description,
      minimumAge: parsed.data.minimumAge,
      maximumAge: parsed.data.maximumAge,
      expectations: parsed.data.expectations,
      attire: parsed.data.attire,
      waiverNotes: parsed.data.waiverNotes,
      active: true,
    });
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Trial class added. Your agent can use this now.");
}

export async function toggleOfferingAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseRequiredId(
    formData,
    "That trial class could not be found.",
  );
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const active = String(formData.get("active")) === "true";
  const db = getDb();
  try {
    const updated = await db
      .update(trialOfferings)
      .set({ active: !active, updatedAt: new Date() })
      .where(
        and(
          eq(trialOfferings.id, parsed.data.id),
          eq(trialOfferings.schoolId, school.id),
        ),
      )
      .returning({ id: trialOfferings.id });
    if (updated.length === 0) {
      return errorState("That trial class could not be found.");
    }
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState(
    active
      ? "Hidden from parents. Weekly times still exist until you deactivate them in Schedule."
      : "This trial class is visible to parents again.",
  );
}

export async function createWindowAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseWindowForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  const [offering] = await db
    .select({ id: trialOfferings.id })
    .from(trialOfferings)
    .where(
      and(
        eq(trialOfferings.id, parsed.data.trialOfferingId),
        eq(trialOfferings.schoolId, school.id),
      ),
    )
    .limit(1);
  if (!offering) {
    return errorState("Choose one of your trial classes.", {
      trialOfferingId: "Choose one of your trial classes.",
    });
  }
  try {
    await db.insert(trialWindows).values({
      schoolId: school.id,
      trialOfferingId: parsed.data.trialOfferingId,
      dayOfWeek: parsed.data.dayOfWeek,
      startMinute: parsed.data.startMinute,
      durationMinutes: parsed.data.durationMinutes,
      capacity: parsed.data.capacity,
      label: parsed.data.label,
      active: true,
    });
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Weekly time added. Your agent can offer this slot now.");
}

export async function deactivateWindowAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseRequiredId(
    formData,
    "That weekly time could not be found.",
  );
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    const updated = await db
      .update(trialWindows)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      )
      .returning({ id: trialWindows.id });
    if (updated.length === 0) {
      return errorState("That weekly time could not be found.");
    }
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState(
    "This time is inactive. Parents will not be offered it, and it cannot be turned back on here.",
  );
}

export async function updateWindowCapacityAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseCapacityForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const { id, capacity } = parsed.data;
  const db = getDb();
  const [owned] = await db
    .select({ id: trialWindows.id })
    .from(trialWindows)
    .where(and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)))
    .limit(1);
  if (!owned) return errorState("That weekly time could not be found.");

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
  const maxFutureBooked = maxBooked?.max ?? 0;
  if (maxFutureBooked > capacity) {
    return errorState(capacityBelowBookedMessage(maxFutureBooked), {
      capacity: capacityBelowBookedMessage(maxFutureBooked),
    });
  }

  try {
    await db
      .update(trialWindows)
      .set({ capacity, updatedAt: new Date() })
      .where(
        and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)),
      );
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
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState(
    "Capacity updated. Upcoming open spots now use this number.",
  );
}

export async function deleteWindowAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseRequiredId(
    formData,
    "That weekly time could not be found.",
  );
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  const [occurrence] = await db
    .select({ id: trialOccurrences.id })
    .from(trialOccurrences)
    .where(
      and(
        eq(trialOccurrences.schoolId, school.id),
        eq(trialOccurrences.trialWindowId, parsed.data.id),
      ),
    )
    .limit(1);
  if (occurrence) {
    return errorState(
      "This time cannot be deleted because a class is already on the calendar. You can deactivate it so parents are not offered new spots.",
    );
  }
  try {
    const deleted = await db
      .delete(trialWindows)
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      )
      .returning({ id: trialWindows.id });
    if (deleted.length === 0) {
      return errorState("That weekly time could not be found.");
    }
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("Weekly time deleted.");
}

export async function createFaqAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseFaqForm(formData);
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(faqs)
    .where(eq(faqs.schoolId, school.id));
  if ((existing[0]?.count ?? 0) >= 20) {
    return errorState("You already have 20 FAQs, the maximum.");
  }
  try {
    await db.insert(faqs).values({
      schoolId: school.id,
      question: parsed.data.question,
      answer: parsed.data.answer,
      sortOrder: existing[0]?.count ?? 0,
    });
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("FAQ added. Your agent can use this now.");
}

export async function deleteFaqAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = parseRequiredId(formData, "That FAQ could not be found.");
  if (!parsed.ok) return errorState(parsed.message, parsed.fieldErrors);
  const db = getDb();
  try {
    const deleted = await db
      .delete(faqs)
      .where(and(eq(faqs.id, parsed.data.id), eq(faqs.schoolId, school.id)))
      .returning({ id: faqs.id });
    if (deleted.length === 0) {
      return errorState("That FAQ could not be found.");
    }
  } catch {
    return errorState(SAVE_FAILED);
  }
  revalidateSettings();
  return successState("FAQ deleted.");
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
