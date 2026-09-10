import { describe, expect, it } from "vitest";
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

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

const validProfile = {
  name: "Tiger Dojo",
  slug: "tiger-dojo",
  timezone: "America/New_York",
  notificationEmail: "owner@school.test",
  phone: "",
  website: "",
  address: "",
  city: "Austin",
  country: "US",
  parkingNotes: "",
  accessNotes: "",
  trialGuidance: "",
};

describe("parseProfileForm", () => {
  it("accepts a complete unpublished profile", () => {
    const parsed = parseProfileForm(form(validProfile), {
      published: false,
      currentSlug: "old-slug",
      currentTimezone: "America/Chicago",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.name).toBe("Tiger Dojo");
      expect(parsed.data.slug).toBe("tiger-dojo");
      expect(parsed.data.notificationEmail).toBe("owner@school.test");
    }
  });

  it("collects field errors instead of failing silently", () => {
    const parsed = parseProfileForm(
      form({
        ...validProfile,
        name: "",
        notificationEmail: "not-an-email",
        slug: "NOPE",
      }),
      {
        published: false,
        currentSlug: "tiger-dojo",
        currentTimezone: "America/New_York",
      },
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.fieldErrors.name).toBeTruthy();
      expect(parsed.fieldErrors.notificationEmail).toBeTruthy();
      expect(parsed.fieldErrors.slug).toBeTruthy();
    }
  });

  it("ignores submitted slug and timezone after publish", () => {
    const parsed = parseProfileForm(
      form({
        ...validProfile,
        slug: "hacked",
        timezone: "Not/AZone",
      }),
      {
        published: true,
        currentSlug: "tiger-dojo",
        currentTimezone: "America/Chicago",
      },
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.slug).toBe("tiger-dojo");
      expect(parsed.data.timezone).toBe("America/Chicago");
    }
  });

  it("rejects notes that exceed the character limit", () => {
    const parsed = parseProfileForm(
      form({ ...validProfile, parkingNotes: "p".repeat(2001) }),
      {
        published: false,
        currentSlug: "tiger-dojo",
        currentTimezone: "America/New_York",
      },
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.fieldErrors.parkingNotes).toMatch(/2,000/);
    }
  });
});

describe("parseBrandingForm", () => {
  it("accepts empty branding", () => {
    const parsed = parseBrandingForm(form({ logoUrl: "", primaryColor: "" }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.logoUrl).toBeNull();
      expect(parsed.data.primaryColor).toBeNull();
    }
  });

  it("requires HTTPS logos and 6-digit hex colors", () => {
    const parsed = parseBrandingForm(
      form({
        logoUrl: "http://example.com/logo.png",
        primaryColor: "#12",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.fieldErrors.logoUrl).toMatch(/HTTPS/i);
      expect(parsed.fieldErrors.primaryColor).toMatch(/6-digit/);
    }
  });

  it("accepts valid HTTPS logo and hex color", () => {
    const parsed = parseBrandingForm(
      form({
        logoUrl: "https://cdn.example.com/logo.png",
        primaryColor: "#1A2B3C",
      }),
    );
    expect(parsed.ok).toBe(true);
  });
});

describe("parseOfferingForm", () => {
  it("requires a name and a valid age range", () => {
    const parsed = parseOfferingForm(
      form({
        name: "",
        minimumAge: "12",
        maximumAge: "8",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.fieldErrors.name).toBeTruthy();
      expect(parsed.fieldErrors.maximumAge).toMatch(/below/);
    }
  });

  it("allows blank ages", () => {
    const parsed = parseOfferingForm(
      form({ name: "Kids beginner trial", description: "", attire: "" }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.minimumAge).toBeNull();
      expect(parsed.data.maximumAge).toBeNull();
    }
  });
});

describe("parseWindowForm", () => {
  it("parses a time input into minutes from midnight", () => {
    const parsed = parseWindowForm(
      form({
        trialOfferingId: "offering-1",
        dayOfWeek: "2",
        startTime: "18:30",
        durationMinutes: "45",
        capacity: "8",
        label: "Tiny Tigers",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.startMinute).toBe(18 * 60 + 30);
      expect(parsed.data.dayOfWeek).toBe(2);
      expect(parsed.data.capacity).toBe(8);
    }
  });

  it("falls back to hour and minute fields", () => {
    const parsed = parseWindowForm(
      form({
        trialOfferingId: "offering-1",
        dayOfWeek: "0",
        startHour: "9",
        startMinute: "15",
        durationMinutes: "60",
        capacity: "4",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.startMinute).toBe(9 * 60 + 15);
  });

  it("rejects capacity outside 1–50", () => {
    const parsed = parseWindowForm(
      form({
        trialOfferingId: "offering-1",
        dayOfWeek: "1",
        startTime: "18:00",
        durationMinutes: "60",
        capacity: "0",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.fieldErrors.capacity).toBeTruthy();
  });
});

describe("parseCapacityForm", () => {
  it("requires an id and a capacity in range", () => {
    expect(parseCapacityForm(form({ id: "", capacity: "8" })).ok).toBe(false);
    expect(parseCapacityForm(form({ id: "w1", capacity: "80" })).ok).toBe(
      false,
    );
    expect(parseCapacityForm(form({ id: "w1", capacity: "8" })).ok).toBe(true);
  });
});

describe("parseFaqForm", () => {
  it("requires question and answer within limits", () => {
    expect(parseFaqForm(form({ question: "", answer: "Yes" })).ok).toBe(false);
    expect(
      parseFaqForm(form({ question: "Do I need experience?", answer: "" })).ok,
    ).toBe(false);
    const long = parseFaqForm(form({ question: "Q".repeat(201), answer: "A" }));
    expect(long.ok).toBe(false);
  });
});

describe("parsePricingForm and parseAgentForm", () => {
  it("enforces character limits", () => {
    expect(parsePricingForm(form({ pricing: "x".repeat(4001) })).ok).toBe(
      false,
    );
    expect(parsePricingForm(form({ pricing: "Drop-in $25" })).ok).toBe(true);
    expect(
      parseAgentForm(
        form({
          welcomeMessage: "y".repeat(1001),
          agentInstructions: "Be kind",
        }),
      ).ok,
    ).toBe(false);
  });
});

describe("parseRequiredId", () => {
  it("rejects a missing id", () => {
    const parsed = parseRequiredId(form({ id: "  " }), "Missing.");
    expect(parsed.ok).toBe(false);
  });
});

describe("capacityBelowBookedMessage", () => {
  it("explains the upcoming-booking restriction", () => {
    expect(capacityBelowBookedMessage(3)).toMatch(/3/);
    expect(capacityBelowBookedMessage(3)).toMatch(/upcoming class/);
  });
});
