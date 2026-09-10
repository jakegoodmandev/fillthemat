"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getDb } from "@/db";
import {
  faqs,
  schools,
  trialOccurrences,
  trialOfferings,
  trialWindows,
} from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import {
  conflictState,
  errorState,
  GENERIC_SERVER_ERROR,
  type SettingsFormState,
  STALE_EDIT_MESSAGE,
  successState,
} from "./form-state";
import { formatCount } from "./format";
import {
  agentSchema,
  brandingSchema,
  capacitySchema,
  faqSchema,
  fieldErrorsFrom,
  formValues,
  idSchema,
  LIMITS,
  offeringSchema,
  pricingSchema,
  profileSchema,
  publicAddressSchema,
  updateFaqSchema,
  updateOfferingSchema,
  windowSchema,
} from "./schemas";

const SETTINGS_PATH = "/dashboard/settings";

/** Render an `updatedAt` value for the optimistic-concurrency token sent to the form. */
function updatedAtIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** True if the saved record's `updatedAt` is still the snapshot the form edited against. */
function rowUpdated(idle: Date | string, expected: Date): boolean {
  const idleTime =
    idle instanceof Date ? idle.getTime() : new Date(idle).getTime();
  return idleTime === expected.getTime();
}

function nullToEmpty(value: string | null | undefined): string {
  return value ?? "";
}

/**
 * Every action returns a `SettingsFormState`; unexpected failures become a
 * server error the owner can act on instead of a silent no-op.
 *
 * Next.js control flow (the `redirect()` inside `requireOwnedSchool()` for an
 * expired session, `notFound()`, …) is implemented by throwing, so it has to be
 * re-thrown before anything is mapped to form state.
 */
async function run(
  work: () => Promise<SettingsFormState>,
): Promise<SettingsFormState> {
  try {
    return await work();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[settings] action failed", error);
    return errorState(GENERIC_SERVER_ERROR);
  }
}

export async function updateProfileAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const published = school.publishedAt != null;

    const parsed = profileSchema.safeParse(
      formValues(formData, [
        "name",
        "notificationEmail",
        "phone",
        "website",
        "address",
        "city",
        "country",
        "parkingNotes",
        "accessNotes",
        "trialGuidance",
      ]),
    );

    let slug = school.slug;
    let timezone = school.timezone;
    let publicErrors: Record<string, string> = {};
    if (!published) {
      const address = publicAddressSchema.safeParse(
        formValues(formData, ["slug", "timezone"]),
      );
      if (address.success) {
        slug = address.data.slug;
        timezone = address.data.timezone;
      } else {
        publicErrors = fieldErrorsFrom(address.error);
      }
    }

    if (!parsed.success || Object.keys(publicErrors).length > 0) {
      return errorState("Check the highlighted fields and save again.", {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...publicErrors,
      });
    }

    const values = parsed.data;
    const db = getDb();
    await db
      .update(schools)
      .set({
        name: values.name,
        slug,
        timezone,
        notificationEmail: values.notificationEmail,
        phone: values.phone,
        website: values.website,
        address: values.address,
        city: values.city,
        country: values.country,
        parkingNotes: values.parkingNotes,
        accessNotes: values.accessNotes,
        trialGuidance: values.trialGuidance,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
    revalidatePath(SETTINGS_PATH);

    return successState("School details saved. Your agent uses them now.", {
      name: values.name,
      slug,
      timezone,
      notificationEmail: values.notificationEmail,
      phone: nullToEmpty(values.phone),
      website: nullToEmpty(values.website),
      address: nullToEmpty(values.address),
      city: nullToEmpty(values.city),
      country: values.country,
      parkingNotes: nullToEmpty(values.parkingNotes),
      accessNotes: nullToEmpty(values.accessNotes),
      trialGuidance: nullToEmpty(values.trialGuidance),
    });
  });
}

export async function updatePricingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = pricingSchema.safeParse(formValues(formData, ["pricing"]));
    if (!parsed.success) {
      return errorState(
        "Check the highlighted field and save again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const db = getDb();
    await db
      .update(schools)
      .set({ pricing: parsed.data.pricing, updatedAt: new Date() })
      .where(eq(schools.id, school.id));
    revalidatePath(SETTINGS_PATH);
    return successState("Pricing saved. Your agent may share it now.", {
      pricing: nullToEmpty(parsed.data.pricing),
    });
  });
}

export async function updateAgentAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = agentSchema.safeParse(
      formValues(formData, ["welcomeMessage", "agentInstructions"]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and save again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const db = getDb();
    await db
      .update(schools)
      .set({
        welcomeMessage: parsed.data.welcomeMessage,
        agentInstructions: parsed.data.agentInstructions,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
    revalidatePath(SETTINGS_PATH);
    return successState("Agent settings saved and live on your page.", {
      welcomeMessage: nullToEmpty(parsed.data.welcomeMessage),
      agentInstructions: nullToEmpty(parsed.data.agentInstructions),
    });
  });
}

export async function updateBrandingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = brandingSchema.safeParse(
      formValues(formData, ["logoUrl", "primaryColor"]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and save again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const db = getDb();
    await db
      .update(schools)
      .set({
        logoUrl: parsed.data.logoUrl,
        primaryColor: parsed.data.primaryColor,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
    revalidatePath(SETTINGS_PATH);
    return successState("Branding saved and live on your public page.", {
      logoUrl: nullToEmpty(parsed.data.logoUrl),
      primaryColor: nullToEmpty(parsed.data.primaryColor),
    });
  });
}

export async function createOfferingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = offeringSchema.safeParse(
      formValues(formData, [
        "name",
        "description",
        "minimumAge",
        "maximumAge",
        "attire",
        "expectations",
        "waiverNotes",
      ]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and add the trial class again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const db = getDb();
    const [created] = await db
      .insert(trialOfferings)
      .values({
        schoolId: school.id,
        name: parsed.data.name,
        description: parsed.data.description,
        minimumAge: parsed.data.minimumAge,
        maximumAge: parsed.data.maximumAge,
        expectations: parsed.data.expectations,
        attire: parsed.data.attire,
        waiverNotes: parsed.data.waiverNotes,
        active: true,
      })
      .returning({ id: trialOfferings.id });
    revalidatePath(SETTINGS_PATH);
    return successState(`“${parsed.data.name}” added and open for bookings.`, {
      id: created?.id ?? "",
    });
  });
}

/**
 * Edit an existing trial class. Updates only the fields the form controls;
 * `active`, `waiverNotes`, and every non-editable column on the row stay as
 * it was. Uses `updatedAt` as an optimistic concurrency token so two owners
 * cannot silently overwrite each other.
 */
export async function updateOfferingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = updateOfferingSchema.safeParse(
      formValues(formData, [
        "id",
        "expectedUpdatedAt",
        "name",
        "description",
        "minimumAge",
        "maximumAge",
        "attire",
        "expectations",
      ]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and save the trial class again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { id, expectedUpdatedAt, ...values } = parsed.data;
    const db = getDb();
    const [existing] = await db
      .select()
      .from(trialOfferings)
      .where(
        and(eq(trialOfferings.id, id), eq(trialOfferings.schoolId, school.id)),
      )
      .limit(1);
    if (!existing) {
      return errorState("That trial class no longer exists. Refresh the page.");
    }
    if (!rowUpdated(existing.updatedAt, expectedUpdatedAt)) {
      return conflictState(STALE_EDIT_MESSAGE, {
        id,
        expectedUpdatedAt: updatedAtIso(existing.updatedAt),
        name: existing.name,
        description: existing.description ?? "",
        minimumAge:
          existing.minimumAge == null ? "" : String(existing.minimumAge),
        maximumAge:
          existing.maximumAge == null ? "" : String(existing.maximumAge),
        attire: existing.attire ?? "",
        expectations: existing.expectations ?? "",
      });
    }
    const updated = await db
      .update(trialOfferings)
      .set({
        name: values.name,
        description: values.description,
        minimumAge: values.minimumAge,
        maximumAge: values.maximumAge,
        attire: values.attire,
        expectations: values.expectations,
        active: existing.active,
        waiverNotes: existing.waiverNotes,
        updatedAt: new Date(),
      })
      .where(
        and(eq(trialOfferings.id, id), eq(trialOfferings.schoolId, school.id)),
      )
      .returning({ updatedAt: trialOfferings.updatedAt });
    revalidatePath(SETTINGS_PATH);
    revalidatePath("/dashboard");
    return successState(
      `“${values.name}” saved. Bookings use the new settings.`,
      {
        id,
        expectedUpdatedAt: updated[0]
          ? updatedAtIso(updated[0].updatedAt)
          : updatedAtIso(expectedUpdatedAt),
        name: values.name,
        description: values.description ?? "",
        minimumAge: values.minimumAge == null ? "" : String(values.minimumAge),
        maximumAge: values.maximumAge == null ? "" : String(values.maximumAge),
        attire: values.attire ?? "",
        expectations: values.expectations ?? "",
      },
    );
  });
}

export async function toggleOfferingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = idSchema.safeParse(formValues(formData, ["id"]));
    if (!parsed.success) {
      return errorState("That trial class no longer exists. Refresh the page.");
    }
    const db = getDb();
    const [offering] = await db
      .select()
      .from(trialOfferings)
      .where(
        and(
          eq(trialOfferings.id, parsed.data.id),
          eq(trialOfferings.schoolId, school.id),
        ),
      )
      .limit(1);
    if (!offering) {
      return errorState("That trial class no longer exists. Refresh the page.");
    }
    const nextActive = !offering.active;
    await db
      .update(trialOfferings)
      .set({ active: nextActive, updatedAt: new Date() })
      .where(
        and(
          eq(trialOfferings.id, offering.id),
          eq(trialOfferings.schoolId, school.id),
        ),
      );
    revalidatePath(SETTINGS_PATH);
    return successState(
      nextActive
        ? `“${offering.name}” is open for bookings again.`
        : `“${offering.name}” is no longer offered to families.`,
    );
  });
}

export async function createWindowAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = windowSchema.safeParse(
      formValues(formData, [
        "trialOfferingId",
        "dayOfWeek",
        "startMinute",
        "durationMinutes",
        "capacity",
        "label",
      ]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and add the class time again.",
        fieldErrorsFrom(parsed.error),
      );
    }
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
      return errorState("Check the highlighted fields and try again.", {
        trialOfferingId: "Choose one of your trial classes.",
      });
    }
    await db.insert(trialWindows).values({
      schoolId: school.id,
      trialOfferingId: offering.id,
      dayOfWeek: parsed.data.dayOfWeek,
      startMinute: parsed.data.startMinute,
      durationMinutes: parsed.data.durationMinutes,
      capacity: parsed.data.capacity,
      label: parsed.data.label,
      active: true,
    });
    revalidatePath(SETTINGS_PATH);
    return successState("Class time added to your weekly schedule.");
  });
}

export async function deactivateWindowAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = idSchema.safeParse(formValues(formData, ["id"]));
    if (!parsed.success) {
      return errorState("That class time no longer exists. Refresh the page.");
    }
    const db = getDb();
    await db
      .update(trialWindows)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      );
    revalidatePath(SETTINGS_PATH);
    return successState(
      "Class time turned off. Bookings families already made are unchanged.",
    );
  });
}

export async function updateWindowCapacityAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = capacitySchema.safeParse(
      formValues(formData, ["id", "capacity"]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the number of spots and try again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { id, capacity } = parsed.data;
    const db = getDb();
    const [existing] = await db
      .select({ id: trialWindows.id })
      .from(trialWindows)
      .where(and(eq(trialWindows.id, id), eq(trialWindows.schoolId, school.id)))
      .limit(1);
    if (!existing) {
      return errorState("That class time no longer exists. Refresh the page.");
    }

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
    const booked = maxBooked?.max ?? 0;
    if (booked > capacity) {
      return errorState(
        `An upcoming class already has ${formatCount(booked, "student")} booked. Keep at least ${booked} spots.`,
        { capacity: `Use ${booked} or more.` },
      );
    }

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
    revalidatePath(SETTINGS_PATH);
    return successState(
      `Saved. Upcoming classes now hold ${formatCount(capacity, "student")}.`,
      { capacity: String(capacity) },
    );
  });
}

export async function deleteWindowAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = idSchema.safeParse(formValues(formData, ["id"]));
    if (!parsed.success) {
      return errorState("That class time no longer exists. Refresh the page.");
    }
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
        "This class time is already on your calendar, so it cannot be deleted. Turn it off instead — upcoming bookings stay valid.",
      );
    }
    await db
      .delete(trialWindows)
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      );
    revalidatePath(SETTINGS_PATH);
    return successState("Class time deleted.");
  });
}

export async function createFaqAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = faqSchema.safeParse(
      formValues(formData, ["question", "answer"]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and add the question again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const db = getDb();
    const [existing] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(eq(faqs.schoolId, school.id));
    const count = existing?.count ?? 0;
    if (count >= LIMITS.faqCount) {
      return errorState(
        `You already have ${LIMITS.faqCount} questions. Delete one before adding another.`,
      );
    }
    const [created] = await db
      .insert(faqs)
      .values({
        schoolId: school.id,
        question: parsed.data.question,
        answer: parsed.data.answer,
        sortOrder: count,
      })
      .returning({ id: faqs.id });
    revalidatePath(SETTINGS_PATH);
    return successState("Question added. Your agent can use this answer now.", {
      id: created?.id ?? "",
    });
  });
}

/**
 * Edit an existing FAQ in place. Bypasses the 20-question cap (creating a new
 * row enforces it; correcting one does not), preserves the row id so any
 * existing sort order, snapshots, or references stay stable, and reports a
 * stale-edit conflict using the same `updatedAt` strategy as offering edits.
 */
export async function updateFaqAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = updateFaqSchema.safeParse(
      formValues(formData, ["id", "expectedUpdatedAt", "question", "answer"]),
    );
    if (!parsed.success) {
      return errorState(
        "Check the highlighted fields and save the question again.",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { id, expectedUpdatedAt, ...values } = parsed.data;
    const db = getDb();
    const [existing] = await db
      .select()
      .from(faqs)
      .where(and(eq(faqs.id, id), eq(faqs.schoolId, school.id)))
      .limit(1);
    if (!existing) {
      return errorState("That question no longer exists. Refresh the page.");
    }
    if (!rowUpdated(existing.updatedAt, expectedUpdatedAt)) {
      return conflictState(STALE_EDIT_MESSAGE, {
        id,
        expectedUpdatedAt: updatedAtIso(existing.updatedAt),
        question: existing.question,
        answer: existing.answer,
      });
    }
    const updated = await db
      .update(faqs)
      .set({
        question: values.question,
        answer: values.answer,
        sortOrder: existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(and(eq(faqs.id, id), eq(faqs.schoolId, school.id)))
      .returning({ updatedAt: faqs.updatedAt });
    revalidatePath(SETTINGS_PATH);
    return successState("Question saved. Your agent will use this answer.", {
      id,
      expectedUpdatedAt: updated[0]
        ? updatedAtIso(updated[0].updatedAt)
        : updatedAtIso(expectedUpdatedAt),
      question: values.question,
      answer: values.answer,
    });
  });
}

export async function deleteFaqAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  return run(async () => {
    const { school } = await requireOwnedSchool();
    const parsed = idSchema.safeParse(formValues(formData, ["id"]));
    if (!parsed.success) {
      return errorState("That question no longer exists. Refresh the page.");
    }
    const db = getDb();
    const deleted = await db
      .delete(faqs)
      .where(and(eq(faqs.id, parsed.data.id), eq(faqs.schoolId, school.id)))
      .returning({ id: faqs.id });
    if (deleted.length === 0) {
      return errorState("That question no longer exists. Refresh the page.");
    }
    revalidatePath(SETTINGS_PATH);
    return successState("Question deleted. Your agent will not use it again.");
  });
}
