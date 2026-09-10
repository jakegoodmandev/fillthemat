import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./settings-sections";
import {
  agentSettingsSchema,
  brandingSettingsSchema,
  capacitySettingsSchema,
  faqSettingsSchema,
  offeringSettingsSchema,
  pricingSettingsSchema,
  profileSettingsSchema,
  windowSettingsSchema,
} from "./settings-validation";

const validProfile = {
  name: "Northside Martial Arts",
  slug: "northside-martial-arts",
  timezone: "America/Los_Angeles",
  notificationEmail: "owner@example.com",
  phone: "",
  website: "",
  address: "",
  city: "Oakland",
  country: "us",
  parkingNotes: "",
  accessNotes: "",
  trialGuidance: "",
};

describe("settings validation", () => {
  it("keeps all 7 deep-linkable categories discoverable", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      "profile",
      "offerings",
      "schedule",
      "pricing",
      "faqs",
      "agent",
      "branding",
    ]);
  });

  it("normalizes profile values and rejects invalid public identifiers", () => {
    const parsed = profileSettingsSchema.parse(validProfile);
    expect(parsed.country).toBe("US");
    expect(parsed.phone).toBeNull();

    expect(
      profileSettingsSchema.safeParse({
        ...validProfile,
        slug: "Not a slug",
        timezone: "Somewhere/Imaginary",
      }).success,
    ).toBe(false);
  });

  it("enforces offering age ranges", () => {
    const result = offeringSettingsSchema.safeParse({
      name: "Kids Trial",
      description: "",
      minimumAge: "12",
      maximumAge: "6",
      expectations: "",
      attire: "",
      waiverNotes: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maximumAge).toEqual([
        "Maximum age must be at least the minimum age.",
      ]);
    }
  });

  it("accepts valid local schedule times and bounded capacity", () => {
    const base = {
      trialOfferingId: "11111111-1111-4111-8111-111111111111",
      dayOfWeek: "1",
      startTime: "18:30",
      durationMinutes: "60",
      capacity: "8",
      label: "After school",
    };
    expect(windowSettingsSchema.safeParse(base).success).toBe(true);
    expect(
      windowSettingsSchema.safeParse({ ...base, startTime: "25:00" }).success,
    ).toBe(false);
    expect(
      capacitySettingsSchema.safeParse({
        id: base.trialOfferingId,
        capacity: "51",
      }).success,
    ).toBe(false);
  });

  it("requires HTTPS logo URLs and 6-digit hex colors", () => {
    expect(
      brandingSettingsSchema.parse({ logoUrl: "", primaryColor: "" }),
    ).toEqual({ logoUrl: null, primaryColor: null });
    expect(
      brandingSettingsSchema.safeParse({
        logoUrl: "http://example.com/logo.png",
        primaryColor: "#abc",
      }).success,
    ).toBe(false);
    expect(
      brandingSettingsSchema.parse({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#f97316",
      }).primaryColor,
    ).toBe("#F97316");
  });

  it("enforces category character limits", () => {
    expect(
      pricingSettingsSchema.safeParse({ pricing: "x".repeat(4001) }).success,
    ).toBe(false);
    expect(
      agentSettingsSchema.safeParse({
        welcomeMessage: "x".repeat(1001),
        agentInstructions: "",
      }).success,
    ).toBe(false);
    expect(
      faqSettingsSchema.safeParse({ question: "Question?", answer: "" })
        .success,
    ).toBe(false);
  });
});
