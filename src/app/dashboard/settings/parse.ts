import { isValidSlug } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";
import { emailSchema, optionalText } from "@/lib/validation";
import { parseTimeInput } from "./format";

export type ParseSuccess<T> = { ok: true; data: T };
export type ParseFailure = {
  ok: false;
  message: string;
  fieldErrors: Record<string, string>;
};
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const TOO_LONG = (max: number) =>
  `Use ${max.toLocaleString()} characters or fewer.`;

function fail(
  fieldErrors: Record<string, string>,
  message = "Check the highlighted fields and try again.",
): ParseFailure {
  return { ok: false, message, fieldErrors };
}

function read(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function takeOptional(
  formData: FormData,
  name: string,
  max: number,
  fieldErrors: Record<string, string>,
): string | null {
  const parsed = optionalText(max).safeParse(read(formData, name));
  if (!parsed.success) {
    fieldErrors[name] = TOO_LONG(max);
    return null;
  }
  return parsed.data;
}

function parseOptionalInt(
  raw: string,
  min: number,
  max: number,
): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < min || value > max) return undefined;
  return value;
}

export type ProfileInput = {
  name: string;
  slug: string;
  timezone: string;
  notificationEmail: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  parkingNotes: string | null;
  accessNotes: string | null;
  trialGuidance: string | null;
};

export function parseProfileForm(
  formData: FormData,
  options: { published: boolean; currentSlug: string; currentTimezone: string },
): ParseResult<ProfileInput> {
  const fieldErrors: Record<string, string> = {};
  const name = read(formData, "name").trim();
  if (!name) fieldErrors.name = "Enter your school name.";
  else if (name.length > 80) fieldErrors.name = TOO_LONG(80);

  const notificationEmail = emailSchema.safeParse(
    formData.get("notificationEmail"),
  );
  if (!notificationEmail.success) {
    fieldErrors.notificationEmail = "Enter a valid email address.";
  }

  let slug = options.currentSlug;
  let timezone = options.currentTimezone;
  if (!options.published) {
    slug = read(formData, "slug").trim();
    timezone = read(formData, "timezone");
    if (!isValidSlug(slug)) {
      fieldErrors.slug = "Use 3–48 lowercase letters, numbers, and hyphens.";
    }
    if (!isValidTimezone(timezone)) {
      fieldErrors.timezone = "Choose a valid timezone.";
    }
  }

  const phone = takeOptional(formData, "phone", 32, fieldErrors);
  const website = takeOptional(formData, "website", 2048, fieldErrors);
  const address = takeOptional(formData, "address", 500, fieldErrors);
  const city = takeOptional(formData, "city", 80, fieldErrors);
  const parkingNotes = takeOptional(
    formData,
    "parkingNotes",
    2000,
    fieldErrors,
  );
  const accessNotes = takeOptional(formData, "accessNotes", 2000, fieldErrors);
  const trialGuidance = takeOptional(
    formData,
    "trialGuidance",
    2000,
    fieldErrors,
  );

  const countryRaw = read(formData, "country").trim();
  let country = "US";
  if (countryRaw) {
    if (!/^[A-Za-z]{2}$/.test(countryRaw)) {
      fieldErrors.country = "Use a 2-letter country code, such as US.";
    } else {
      country = countryRaw.toUpperCase();
    }
  }

  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  if (!notificationEmail.success) return fail(fieldErrors);

  return {
    ok: true,
    data: {
      name,
      slug,
      timezone,
      notificationEmail: notificationEmail.data,
      phone,
      website,
      address,
      city,
      country,
      parkingNotes,
      accessNotes,
      trialGuidance,
    },
  };
}

export function parsePricingForm(
  formData: FormData,
): ParseResult<{ pricing: string | null }> {
  const fieldErrors: Record<string, string> = {};
  const pricing = takeOptional(formData, "pricing", 4000, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return { ok: true, data: { pricing } };
}

export function parseAgentForm(formData: FormData): ParseResult<{
  welcomeMessage: string | null;
  agentInstructions: string | null;
}> {
  const fieldErrors: Record<string, string> = {};
  const welcomeMessage = takeOptional(
    formData,
    "welcomeMessage",
    1000,
    fieldErrors,
  );
  const agentInstructions = takeOptional(
    formData,
    "agentInstructions",
    2000,
    fieldErrors,
  );
  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return { ok: true, data: { welcomeMessage, agentInstructions } };
}

export function parseBrandingForm(formData: FormData): ParseResult<{
  logoUrl: string | null;
  primaryColor: string | null;
}> {
  const fieldErrors: Record<string, string> = {};
  const logoUrl = takeOptional(formData, "logoUrl", 2048, fieldErrors);
  const primaryColor = takeOptional(formData, "primaryColor", 7, fieldErrors);

  if (logoUrl && !logoUrl.startsWith("https://")) {
    fieldErrors.logoUrl = "Use a full HTTPS link, starting with https://.";
  }
  if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    fieldErrors.primaryColor = "Use a 6-digit color such as #123456.";
  }

  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return { ok: true, data: { logoUrl, primaryColor } };
}

export type OfferingInput = {
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  expectations: string | null;
  attire: string | null;
  waiverNotes: string | null;
};

export function parseOfferingForm(
  formData: FormData,
): ParseResult<OfferingInput> {
  const fieldErrors: Record<string, string> = {};
  const name = read(formData, "name").trim();
  if (!name) fieldErrors.name = "Enter a name for this trial class.";
  else if (name.length > 80) fieldErrors.name = TOO_LONG(80);

  const description = takeOptional(formData, "description", 2000, fieldErrors);
  const expectations = takeOptional(
    formData,
    "expectations",
    2000,
    fieldErrors,
  );
  const attire = takeOptional(formData, "attire", 1000, fieldErrors);
  const waiverNotes = takeOptional(formData, "waiverNotes", 1000, fieldErrors);

  const minimumAge = parseOptionalInt(read(formData, "minimumAge"), 0, 99);
  const maximumAge = parseOptionalInt(read(formData, "maximumAge"), 0, 99);
  if (minimumAge === undefined) {
    fieldErrors.minimumAge = "Use a whole number from 0 to 99, or leave blank.";
  }
  if (maximumAge === undefined) {
    fieldErrors.maximumAge = "Use a whole number from 0 to 99, or leave blank.";
  }
  if (
    minimumAge != null &&
    maximumAge != null &&
    minimumAge !== undefined &&
    maximumAge !== undefined &&
    minimumAge > maximumAge
  ) {
    fieldErrors.maximumAge = "Maximum age cannot be below the minimum age.";
  }

  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return {
    ok: true,
    data: {
      name,
      description,
      minimumAge: minimumAge ?? null,
      maximumAge: maximumAge ?? null,
      expectations,
      attire,
      waiverNotes,
    },
  };
}

export type WindowInput = {
  trialOfferingId: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  label: string | null;
};

export function parseWindowForm(formData: FormData): ParseResult<WindowInput> {
  const fieldErrors: Record<string, string> = {};
  const trialOfferingId = read(formData, "trialOfferingId").trim();
  if (!trialOfferingId) {
    fieldErrors.trialOfferingId = "Choose a trial class.";
  }

  const dayOfWeek = Number(read(formData, "dayOfWeek"));
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    fieldErrors.dayOfWeek = "Choose a day of the week.";
  }

  const startTime = read(formData, "startTime");
  let startMinute = parseTimeInput(startTime);
  if (startMinute == null) {
    const startHour = Number(read(formData, "startHour"));
    const startMinutePart = Number(read(formData, "startMinute"));
    if (
      Number.isInteger(startHour) &&
      Number.isInteger(startMinutePart) &&
      startHour >= 0 &&
      startHour <= 23 &&
      startMinutePart >= 0 &&
      startMinutePart <= 59
    ) {
      startMinute = startHour * 60 + startMinutePart;
    } else {
      fieldErrors.startTime = "Enter a start time.";
      startMinute = 0;
    }
  }

  const durationMinutes = Number(read(formData, "durationMinutes"));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    fieldErrors.durationMinutes = "Enter a duration of at least 1 minute.";
  }

  const capacity = Number(read(formData, "capacity"));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    fieldErrors.capacity = "Capacity must be between 1 and 50.";
  }

  const label = takeOptional(formData, "label", 80, fieldErrors);

  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return {
    ok: true,
    data: {
      trialOfferingId,
      dayOfWeek,
      startMinute,
      durationMinutes,
      capacity,
      label,
    },
  };
}

export function parseCapacityForm(
  formData: FormData,
): ParseResult<{ id: string; capacity: number }> {
  const fieldErrors: Record<string, string> = {};
  const id = read(formData, "id").trim();
  if (!id) fieldErrors.id = "Missing schedule time.";
  const capacity = Number(read(formData, "capacity"));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    fieldErrors.capacity = "Capacity must be between 1 and 50.";
  }
  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return { ok: true, data: { id, capacity } };
}

export function parseRequiredId(
  formData: FormData,
  message = "That item could not be found.",
): ParseResult<{ id: string }> {
  const id = read(formData, "id").trim();
  if (!id) return fail({ id: message }, message);
  return { ok: true, data: { id } };
}

export function parseFaqForm(
  formData: FormData,
): ParseResult<{ question: string; answer: string }> {
  const fieldErrors: Record<string, string> = {};
  const question = read(formData, "question").trim();
  const answer = read(formData, "answer").trim();
  if (!question) fieldErrors.question = "Enter a question.";
  else if (question.length > 200) fieldErrors.question = TOO_LONG(200);
  if (!answer) fieldErrors.answer = "Enter an answer.";
  else if (answer.length > 2000) fieldErrors.answer = TOO_LONG(2000);
  if (Object.keys(fieldErrors).length > 0) return fail(fieldErrors);
  return { ok: true, data: { question, answer } };
}

export function capacityBelowBookedMessage(maxFutureBooked: number): string {
  return `Capacity cannot go below ${maxFutureBooked} because that many students are already booked on an upcoming class.`;
}
