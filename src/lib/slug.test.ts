import { describe, expect, it } from "vitest";
import { isValidSlug, normalizeSlug } from "./slug";

describe("normalizeSlug", () => {
  it("lowercases and hyphenates groups", () => {
    expect(normalizeSlug(" Tiger  Dojo ")).toBe("tiger-dojo");
    expect(normalizeSlug("Tiger--Dojo!!!NYC")).toBe("tiger-dojo-nyc");
  });

  it("trims to 48 characters", () => {
    expect(normalizeSlug("a".repeat(60)).length).toBe(48);
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase hyphenated groups", () => {
    expect(isValidSlug("tiger-dojo")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("rejects short, uppercase, or edge hyphens", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Tiger")).toBe(false);
    expect(isValidSlug("-tiger")).toBe(false);
    expect(isValidSlug("tiger-")).toBe(false);
  });
});
