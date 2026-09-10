import { describe, expect, it } from "vitest";
import {
  conversionRate,
  formatConversionRate,
  formatConversionScope,
} from "./metrics";

describe("conversionRate", () => {
  it("returns null when the denominator is zero", () => {
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(5, 0)).toBeNull();
  });

  it("computes a rounded rate to one decimal", () => {
    expect(conversionRate(10, 80)).toBe(12.5);
    expect(conversionRate(1, 3)).toBe(33.3);
  });

  it("never clamps a broken calculation to 100%", () => {
    // A subset guarantee means this should not happen, but defensive math must
    // not manufacture 100% either — it just reports the ratio it was given.
    expect(conversionRate(3, 2)).toBe(150);
  });

  it("returns 0% when there are eligible sessions but none converted", () => {
    expect(conversionRate(0, 7)).toBe(0);
  });
});

describe("formatConversionRate", () => {
  it("shows an em dash with no eligible sessions", () => {
    expect(formatConversionRate(0, 0)).toBe("—");
  });

  it("shows 0% only for a real zero numerator", () => {
    expect(formatConversionRate(0, 7)).toBe("0%");
  });
});

describe("formatConversionScope", () => {
  it("shows evidence when the denominator exists", () => {
    expect(formatConversionScope(10, 80)).toBe("10 of 80 eligible sessions");
  });

  it("explains the missing denominator", () => {
    expect(formatConversionScope(0, 0)).toBe("No eligible sessions yet");
  });
});
