import { z } from "zod";
import { isValidSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";
import { emailSchema } from "@/lib/validation";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value ? value : null));

const optionalAge = z.preprocess(
  (value) => (value === "" || value == null ? undefined : Number(value)),
  z
    .number()
    .int("Use a whole number.")
    .min(0, "Age cannot be negative.")
    .max(99, "Age must be 99 or younger.")
    .optional(),
);

const requiredInteger = (minimum: number, maximum: number, message: string) =>
  z.preprocess(
    (value) => Number(value),
    z
      .number()
      .int("Use a whole number.")
      .min(minimum, message)
      .max(maximum, message),
  );

export const profileSettingsSchema = z.object({
  name: requiredText("School name", 80),
  slug: z
    .string()
    .trim()
    .refine(isValidSlug, "Use 3–48 lowercase letters, numbers, and hyphens."),
  timezone: z.string().refine(isValidTimezone, "Choose a valid timezone."),
  notificationEmail: emailSchema,
  phone: optionalText("Phone number", 32),
  website: optionalText("Website", 2048),
  address: optionalText("Address", 500),
  city: optionalText("City", 80),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a 2-letter country code, such as US."),
  parkingNotes: optionalText("Parking notes", 2000),
  accessNotes: optionalText("Access notes", 2000),
  trialGuidance: optionalText("Trial guidance", 2000),
});

export const pricingSettingsSchema = z.object({
  pricing: optionalText("Pricing", 4000),
});

export const agentSettingsSchema = z.object({
  welcomeMessage: optionalText("Welcome message", 1000),
  agentInstructions: optionalText("Agent guidance", 2000),
});

function isHttpsUrl(value: string) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const brandingSettingsSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .max(2048, "Logo URL must be 2,048 characters or fewer.")
    .refine(isHttpsUrl, "Enter a complete HTTPS URL.")
    .transform((value) => (value ? value : null)),
  primaryColor: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^#[0-9A-Fa-f]{6}$/.test(value),
      "Use a 6-digit hex color, such as #F97316.",
    )
    .transform((value) => (value ? value.toUpperCase() : null)),
});

export const offeringSettingsSchema = z
  .object({
    name: requiredText("Offering name", 80),
    description: optionalText("Description", 2000),
    minimumAge: optionalAge,
    maximumAge: optionalAge,
    expectations: optionalText("Expectations", 2000),
    attire: optionalText("Attire", 1000),
    waiverNotes: optionalText("Waiver notes", 1000),
  })
  .superRefine((value, context) => {
    if (
      value.minimumAge != null &&
      value.maximumAge != null &&
      value.minimumAge > value.maximumAge
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumAge"],
        message: "Maximum age must be at least the minimum age.",
      });
    }
  });

export const idSchema = z.object({
  id: z
    .string()
    .uuid("This item is no longer available. Retry after refreshing."),
});

export const windowSettingsSchema = z.object({
  trialOfferingId: z.string().uuid("Choose an offering."),
  dayOfWeek: requiredInteger(0, 6, "Choose a day."),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid local start time."),
  durationMinutes: z.preprocess(
    (value) => Number(value),
    z
      .number()
      .int("Use a whole number of minutes.")
      .min(15, "Duration must be at least 15 minutes."),
  ),
  capacity: requiredInteger(1, 50, "Capacity must be from 1 to 50."),
  label: optionalText("Schedule label", 80),
});

export const capacitySettingsSchema = z.object({
  id: z.string().uuid("This schedule window is no longer available."),
  capacity: requiredInteger(1, 50, "Capacity must be from 1 to 50."),
});

export const faqSettingsSchema = z.object({
  question: requiredText("Question", 200),
  answer: requiredText("Answer", 2000),
});

export type SettingsFieldErrors = Record<string, string[]>;

export function fieldErrors(error: z.ZodError): SettingsFieldErrors {
  return error.flatten().fieldErrors as SettingsFieldErrors;
}
