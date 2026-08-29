import { describe, expect, it } from "vitest";
import { privacySafeMetadata } from "./funnel";

describe("privacySafeMetadata", () => {
  it("strips PII and overlong strings", () => {
    expect(
      privacySafeMetadata({
        email: "a@b.com",
        phone: "555",
        name: "Ada",
        offeringId: "abc",
        remaining: 2,
        prompt: "secret",
        note: "x".repeat(201),
      }),
    ).toEqual({ offeringId: "abc", remaining: 2 });
  });
});
