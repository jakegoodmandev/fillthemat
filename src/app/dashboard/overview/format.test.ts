import { describe, expect, it } from "vitest";
import { formatBookingConversion } from "./format";

describe("formatBookingConversion", () => {
  it("is undefined when there are no eligible sessions", () => {
    expect(formatBookingConversion(0, 0)).toEqual({
      value: "—",
      evidence: "No eligible sessions yet",
      defined: false,
    });
    expect(formatBookingConversion(4, 0).value).toBe("—");
  });

  it("shows 0% only when eligible sessions exist and none converted", () => {
    expect(formatBookingConversion(0, 8)).toEqual({
      value: "0%",
      evidence: "0 of 8 eligible sessions · All time",
      defined: true,
    });
  });

  it("rounds to one decimal and does not clamp above 100%", () => {
    expect(formatBookingConversion(10, 80).value).toBe("12.5%");
    expect(formatBookingConversion(1, 3).value).toBe("33.3%");
    expect(formatBookingConversion(2, 1).value).toBe("200%");
  });
});
