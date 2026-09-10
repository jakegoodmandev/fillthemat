"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
  agentSettingsSchema,
  brandingSettingsSchema,
  capacitySettingsSchema,
  faqSettingsSchema,
  fieldErrors,
  idSchema,
  offeringSettingsSchema,
  pricingSettingsSchema,
  profileSettingsSchema,
  type SettingsFieldErrors,
  windowSettingsSchema,
} from "./settings-validation";

const SETTINGS_PATH = "/dashboard/settings";

export type SettingsActionState = {
  status: "idle" | "success" | "validation" | "error";
  message: string;
  fieldErrors?: SettingsFieldErrors;
  submittedAt: number;
};

function validationFailure(
  message: string,
  errors?: SettingsFieldErrors,
): SettingsActionState {
  return {
    status: "validation",
    message,
    fieldErrors: errors,
    submittedAt: Date.now(),
  };
}

function success(message: string): SettingsActionState {
  revalidatePath(SETTINGS_PATH);
  return { status: "success", message, submittedAt: Date.now() };
}

function serverFailure(error: unknown): SettingsActionState {
  console.error("Settings action failed", error);
  return {
    status: "error",
    message:
      "We couldn’t save that change. Your entries are still here—check your connection and try again.",
    submittedAt: Date.now(),
  };
}

function formValues(formData: FormData, names: string[]) {
  return Object.fromEntries(
    names.map((name) => [name, String(formData.get(name) ?? "")]),
  );
}

export async function updateProfileAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const raw = formValues(formData, [
    "name",
    "slug",
    "timezone",
    "notificationEmail",
    "phone",
    "website",
    "address",
    "city",
    "country",
    "parkingNotes",
    "accessNotes",
    "trialGuidance",
  ]);
  if (school.publishedAt) {
    raw.slug = school.slug;
    raw.timezone = school.timezone;
  }
  const parsed = profileSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted profile fields and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    const data = parsed.data;
    await getDb()
      .update(schools)
      .set({
        ...data,
        slug: school.publishedAt ? school.slug : data.slug,
        timezone: school.publishedAt ? school.timezone : data.timezone,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));
    return success("Profile saved. Your live agent now uses these details.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function updatePricingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = pricingSettingsSchema.safeParse(
    formValues(formData, ["pricing"]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the pricing information and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    await getDb()
      .update(schools)
      .set({ pricing: parsed.data.pricing, updatedAt: new Date() })
      .where(eq(schools.id, school.id));
    return success("Pricing saved. Your live agent now uses this information.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function updateAgentAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = agentSettingsSchema.safeParse(
    formValues(formData, ["welcomeMessage", "agentInstructions"]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the agent guidance and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    await getDb()
      .update(schools)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schools.id, school.id));
    return success("Agent guidance saved and live.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function updateBrandingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = brandingSettingsSchema.safeParse(
    formValues(formData, ["logoUrl", "primaryColor"]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the branding fields and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    await getDb()
      .update(schools)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schools.id, school.id));
    return success("Branding saved and live.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function createOfferingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = offeringSettingsSchema.safeParse(
    formValues(formData, [
      "name",
      "description",
      "minimumAge",
      "maximumAge",
      "expectations",
      "attire",
      "waiverNotes",
    ]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the offering details and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    await getDb()
      .insert(trialOfferings)
      .values({
        schoolId: school.id,
        ...parsed.data,
        active: true,
      });
    return success("Offering added and active.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function toggleOfferingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = idSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) {
    return validationFailure(
      "This offering is no longer available. Refresh and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    const db = getDb();
    const [offering] = await db
      .select({ active: trialOfferings.active })
      .from(trialOfferings)
      .where(
        and(
          eq(trialOfferings.id, parsed.data.id),
          eq(trialOfferings.schoolId, school.id),
        ),
      )
      .limit(1);
    if (!offering) {
      return validationFailure(
        "This offering is no longer available. Refresh and try again.",
      );
    }
    await db
      .update(trialOfferings)
      .set({ active: !offering.active, updatedAt: new Date() })
      .where(
        and(
          eq(trialOfferings.id, parsed.data.id),
          eq(trialOfferings.schoolId, school.id),
        ),
      );
    return success(
      offering.active ? "Offering deactivated." : "Offering activated.",
    );
  } catch (error) {
    return serverFailure(error);
  }
}

export async function createWindowAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = windowSettingsSchema.safeParse(
    formValues(formData, [
      "trialOfferingId",
      "dayOfWeek",
      "startTime",
      "durationMinutes",
      "capacity",
      "label",
    ]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the schedule window and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
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
      return validationFailure(
        "Choose an offering that belongs to your school.",
        {
          trialOfferingId: ["Choose an available offering."],
        },
      );
    }
    const { startTime, ...data } = parsed.data;
    const [startHour, startMinute] = startTime.split(":").map(Number);
    await db.insert(trialWindows).values({
      schoolId: school.id,
      ...data,
      startMinute: startHour * 60 + startMinute,
      active: true,
    });
    return success("Schedule window added and active.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function deactivateWindowAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = idSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) {
    return validationFailure("This schedule window is no longer available.");
  }

  try {
    await getDb()
      .update(trialWindows)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      );
    return success(
      "Schedule window deactivated. Existing bookings are unchanged.",
    );
  } catch (error) {
    return serverFailure(error);
  }
}

export async function updateWindowCapacityAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = capacitySettingsSchema.safeParse(
    formValues(formData, ["id", "capacity"]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Review the capacity and try again.",
      fieldErrors(parsed.error),
    );
  }

  try {
    const db = getDb();
    const [window] = await db
      .select({ id: trialWindows.id })
      .from(trialWindows)
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      )
      .limit(1);
    if (!window) {
      return validationFailure(
        "This schedule window is no longer available. Refresh and try again.",
      );
    }
    const [maxBooked] = await db
      .select({
        max: sql<number>`coalesce(max(${trialOccurrences.bookedCount}), 0)::int`,
      })
      .from(trialOccurrences)
      .where(
        and(
          eq(trialOccurrences.schoolId, school.id),
          eq(trialOccurrences.trialWindowId, parsed.data.id),
          gt(trialOccurrences.startAt, new Date()),
        ),
      );
    if ((maxBooked?.max ?? 0) > parsed.data.capacity) {
      return validationFailure(
        `Capacity cannot be lower than ${maxBooked.max}, the most students already booked into a future class.`,
        { capacity: [`Use ${maxBooked.max} or more.`] },
      );
    }

    await db
      .update(trialWindows)
      .set({ capacity: parsed.data.capacity, updatedAt: new Date() })
      .where(
        and(
          eq(trialWindows.id, parsed.data.id),
          eq(trialWindows.schoolId, school.id),
        ),
      );
    await db
      .update(trialOccurrences)
      .set({ capacity: parsed.data.capacity, updatedAt: new Date() })
      .where(
        and(
          eq(trialOccurrences.schoolId, school.id),
          eq(trialOccurrences.trialWindowId, parsed.data.id),
          gt(trialOccurrences.startAt, new Date()),
          sql`${trialOccurrences.bookedCount} <= ${parsed.data.capacity}`,
        ),
      );
    return success("Capacity updated for this window and its future classes.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function deleteWindowAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = idSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) {
    return validationFailure("This schedule window is no longer available.");
  }

  try {
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
      return validationFailure(
        "This window has already generated a class, so it can’t be deleted. Deactivate it instead to preserve booking history.",
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
    return success("Schedule window deleted.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function createFaqAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = faqSettingsSchema.safeParse(
    formValues(formData, ["question", "answer"]),
  );
  if (!parsed.success) {
    return validationFailure(
      "Add both a question and a useful answer.",
      fieldErrors(parsed.error),
    );
  }

  try {
    const db = getDb();
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(eq(faqs.schoolId, school.id));
    const count = existing[0]?.count ?? 0;
    if (count >= 20) {
      return validationFailure(
        "You can add up to 20 FAQs. Delete one before adding another.",
      );
    }
    await db.insert(faqs).values({
      schoolId: school.id,
      ...parsed.data,
      sortOrder: count,
    });
    return success("FAQ added and live.");
  } catch (error) {
    return serverFailure(error);
  }
}

export async function deleteFaqAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { school } = await requireOwnedSchool();
  const parsed = idSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) {
    return validationFailure("This FAQ is no longer available.");
  }

  try {
    await getDb()
      .delete(faqs)
      .where(and(eq(faqs.id, parsed.data.id), eq(faqs.schoolId, school.id)));
    return success("FAQ deleted.");
  } catch (error) {
    return serverFailure(error);
  }
}
