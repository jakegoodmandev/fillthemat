import { describe, expect, it } from "vitest";
import { SETTINGS_CATEGORIES, settingsCategoryHref } from "./categories";
import {
  formatAgeRange,
  formatDuration,
  formatLocation,
  formatMinutesAsInputValue,
  formatMinutesAsTime,
  parseTimeInput,
} from "./format";

describe("time formatting", () => {
  it("formats and parses minutes from midnight", () => {
    expect(formatMinutesAsInputValue(18 * 60 + 5)).toBe("18:05");
    expect(parseTimeInput("18:05")).toBe(18 * 60 + 5);
    expect(parseTimeInput("7:00")).toBe(7 * 60);
    expect(parseTimeInput("18:00:00")).toBe(18 * 60);
    expect(parseTimeInput("25:00")).toBeNull();
    expect(formatMinutesAsTime(0)).toMatch(/12:00/);
  });
});

describe("formatAgeRange", () => {
  it("describes open and closed ranges", () => {
    expect(formatAgeRange(null, null)).toBe("Any age");
    expect(formatAgeRange(5, 12)).toBe("Ages 5–12");
    expect(formatAgeRange(13, null)).toBe("Ages 13+");
    expect(formatAgeRange(null, 10)).toBe("Ages up to 10");
  });
});

describe("formatDuration and formatLocation", () => {
  it("uses plain language", () => {
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(45)).toBe("45 minutes");
    expect(formatLocation("123 Main", "Austin")).toBe("123 Main, Austin");
    expect(formatLocation(null, null)).toBeNull();
  });
});

describe("settingsCategoryHref", () => {
  it("deep-links profile to the settings index and others to nested paths", () => {
    expect(settingsCategoryHref("profile")).toBe("/dashboard/settings");
    expect(settingsCategoryHref("branding")).toBe(
      "/dashboard/settings/branding",
    );
    expect(SETTINGS_CATEGORIES).toHaveLength(7);
  });
});
