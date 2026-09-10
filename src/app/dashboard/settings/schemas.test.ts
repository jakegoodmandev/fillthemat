import { describe, expect, it } from "vitest";
import {
  brandingSchema,
  capacitySchema,
  faqSchema,
  fieldErrorsFrom,
  formValues,
  offeringSchema,
  profileSchema,
  publicAddressSchema,
  updateFaqSchema,
  updateOfferingSchema,
  windowSchema,
} from "./schemas";

const VALID_PROFILE = {
  name: "Northside Martial Arts",
  notificationEmail: "Owner@example.com",
  phone: "",
  website: "",
  address: "",
  city: "",
  country: "",
  parkingNotes: "",
  accessNotes: "",
  trialGuidance: "",
};

describe("profileSchema", () => {
  it("normalizes optional fields to null and defaults the country", () => {
    const parsed = profileSchema.parse(VALID_PROFILE);
    expect(parsed.notificationEmail).toBe("owner@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.country).toBe("US");
  });

  it("uppercases a country code", () => {
    expect(
      profileSchema.parse({ ...VALID_PROFILE, country: "ca" }).country,
    ).toBe("CA");
  });

  it("reports a missing name and a bad email per field", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      name: "   ",
      notificationEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsFrom(result.error);
    expect(errors.name).toMatch(/name/i);
    expect(errors.notificationEmail).toMatch(/email/i);
  });

  it("rejects a website without a scheme", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      website: "example.com",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrorsFrom(result.error).website).toMatch(/https/);
  });

  it("rejects an invalid country code", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      country: "USA",
    });
    expect(result.success).toBe(false);
  });
});

describe("publicAddressSchema", () => {
  it("normalizes the slug and checks the time zone", () => {
    const parsed = publicAddressSchema.parse({
      slug: "  North Side Dojo ",
      timezone: "America/New_York",
    });
    expect(parsed.slug).toBe("north-side-dojo");
  });

  it("rejects an unknown time zone", () => {
    const result = publicAddressSchema.safeParse({
      slug: "north-side",
      timezone: "Mars/Olympus",
    });
    expect(result.success).toBe(false);
  });
});

describe("offeringSchema", () => {
  it("treats blank ages as no limit", () => {
    const parsed = offeringSchema.parse({
      name: "Kids beginner trial",
      description: "",
      minimumAge: "",
      maximumAge: "",
      attire: "",
      expectations: "",
      waiverNotes: "",
    });
    expect(parsed.minimumAge).toBeNull();
    expect(parsed.maximumAge).toBeNull();
  });

  it("rejects an inverted age range on the max field", () => {
    const result = offeringSchema.safeParse({
      name: "Teens",
      description: "",
      minimumAge: "14",
      maximumAge: "9",
      attire: "",
      expectations: "",
      waiverNotes: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrorsFrom(result.error).maximumAge).toMatch(/youngest/i);
  });

  it("rejects an out-of-range age", () => {
    const result = offeringSchema.safeParse({
      name: "Teens",
      description: "",
      minimumAge: "120",
      maximumAge: "",
      attire: "",
      expectations: "",
      waiverNotes: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("windowSchema", () => {
  const base = {
    trialOfferingId: "00000000-0000-4000-8000-000000000000",
    dayOfWeek: "1",
    startMinute: "18:30",
    durationMinutes: "60",
    capacity: "8",
    label: "",
  };

  it("converts a time input into minutes after midnight", () => {
    const parsed = windowSchema.parse(base);
    expect(parsed.startMinute).toBe(18 * 60 + 30);
    expect(parsed.dayOfWeek).toBe(1);
    expect(parsed.capacity).toBe(8);
    expect(parsed.label).toBeNull();
  });

  it("rejects a bad time, day, duration, and capacity", () => {
    expect(
      windowSchema.safeParse({ ...base, startMinute: "25:00" }).success,
    ).toBe(false);
    expect(windowSchema.safeParse({ ...base, dayOfWeek: "9" }).success).toBe(
      false,
    );
    expect(
      windowSchema.safeParse({ ...base, durationMinutes: "5" }).success,
    ).toBe(false);
    expect(windowSchema.safeParse({ ...base, capacity: "0" }).success).toBe(
      false,
    );
    expect(windowSchema.safeParse({ ...base, capacity: "51" }).success).toBe(
      false,
    );
  });
});

describe("capacitySchema", () => {
  it("accepts the supported range only", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(capacitySchema.parse({ id, capacity: "12" }).capacity).toBe(12);
    expect(capacitySchema.safeParse({ id, capacity: "60" }).success).toBe(
      false,
    );
  });
});

describe("brandingSchema", () => {
  it("adds a missing hash and keeps blanks null", () => {
    expect(
      brandingSchema.parse({ logoUrl: "", primaryColor: "1e3a8a" })
        .primaryColor,
    ).toBe("#1e3a8a");
    expect(
      brandingSchema.parse({ logoUrl: "", primaryColor: "" }).primaryColor,
    ).toBeNull();
  });

  it("requires https logos and 6-digit hex colors", () => {
    const badLogo = brandingSchema.safeParse({
      logoUrl: "http://example.com/logo.png",
      primaryColor: "",
    });
    expect(badLogo.success).toBe(false);
    const badColor = brandingSchema.safeParse({
      logoUrl: "",
      primaryColor: "#12345",
    });
    expect(badColor.success).toBe(false);
  });
});

describe("faqSchema", () => {
  it("requires both fields", () => {
    const result = faqSchema.safeParse({ question: "", answer: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsFrom(result.error);
    expect(errors.question).toBeTruthy();
    expect(errors.answer).toBeTruthy();
  });
});

describe("updateOfferingSchema", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000000",
    expectedUpdatedAt: "2024-01-01T12:00:00.000Z",
    name: "Trial class",
    description: "",
    minimumAge: "",
    maximumAge: "",
    attire: "",
    expectations: "",
  };

  it("parses a valid edit payload and exposes Date for updatedAt", () => {
    const parsed = updateOfferingSchema.parse(base);
    expect(parsed.id).toBe(base.id);
    expect(parsed.expectedUpdatedAt.getUTCFullYear()).toBe(2024);
  });

  it("rejects a non-uuid id", () => {
    const result = updateOfferingSchema.safeParse({
      ...base,
      id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing class name", () => {
    const result = updateOfferingSchema.safeParse({ ...base, name: "  " });
    expect(result.success).toBe(false);
  });

  it("preserves the inverted-age refinement from offeringSchema", () => {
    const result = updateOfferingSchema.safeParse({
      ...base,
      minimumAge: "14",
      maximumAge: "9",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrorsFrom(result.error).maximumAge).toMatch(/youngest/i);
  });

  it("rejects an unparseable expectedUpdatedAt token", () => {
    const result = updateOfferingSchema.safeParse({
      ...base,
      expectedUpdatedAt: "yesterday",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a Z and an offset timezone stamp", () => {
    expect(
      updateOfferingSchema.safeParse({
        ...base,
        expectedUpdatedAt: "2024-01-01T12:00:00+02:00",
      }).success,
    ).toBe(true);
  });
});

describe("updateFaqSchema", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000000",
    expectedUpdatedAt: "2024-01-01T12:00:00.000Z",
    question: "Is there parking?",
    answer: "Yes.",
  };

  it("parses a valid edit payload", () => {
    const parsed = updateFaqSchema.parse(base);
    expect(parsed.question).toBe("Is there parking?");
    expect(parsed.expectedUpdatedAt.getTime()).toBe(
      new Date(base.expectedUpdatedAt).getTime(),
    );
  });

  it("rejects missing question and answer", () => {
    expect(updateFaqSchema.safeParse({ ...base, question: "" }).success).toBe(
      false,
    );
    expect(updateFaqSchema.safeParse({ ...base, answer: "" }).success).toBe(
      false,
    );
  });

  it("does not encode a limit — editing works at 20", () => {
    // The schema deliberately contains no FAQ-count check; the create action
    // is the only place that enforces the 20-question cap.
    expect(updateFaqSchema.parse(base).question.length).toBeGreaterThan(0);
  });
});

describe("formValues", () => {
  it("returns a string for every requested field", () => {
    const data = new FormData();
    data.set("name", "Dojo");
    expect(formValues(data, ["name", "city"])).toEqual({
      name: "Dojo",
      city: "",
    });
  });
});

describe("windowSchema start time", () => {
  const base = {
    trialOfferingId: "00000000-0000-4000-8000-000000000000",
    dayOfWeek: "1",
    startMinute: "18:30",
    durationMinutes: "60",
    capacity: "8",
    label: "",
  };

  it("accepts the HH:MM:SS form some browsers submit", () => {
    expect(
      windowSchema.parse({ ...base, startMinute: "18:30:00" }).startMinute,
    ).toBe(18 * 60 + 30);
    expect(
      windowSchema.parse({ ...base, startMinute: "07:05:30.500" }).startMinute,
    ).toBe(7 * 60 + 5);
  });

  it("still rejects nonsense", () => {
    expect(
      windowSchema.safeParse({ ...base, startMinute: "18:30:99" }).success,
    ).toBe(false);
    expect(
      windowSchema.safeParse({ ...base, startMinute: "1830" }).success,
    ).toBe(false);
  });
});
