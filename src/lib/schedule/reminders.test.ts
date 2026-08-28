import { describe, expect, it } from "vitest";
import { shouldCreateReminder } from "./reminders";

describe("shouldCreateReminder", () => {
  it("does not remind when the booking was created inside 36 hours of class", () => {
    const startAt = new Date("2026-03-10T22:00:00.000Z");
    const createdAt = new Date("2026-03-09T20:00:00.000Z");
    const now = new Date("2026-03-10T10:00:00.000Z");
    expect(shouldCreateReminder({ createdAt, startAt, now })).toBe(false);
  });

  it("reminds when the class enters the 24-hour window and was booked early enough", () => {
    const startAt = new Date("2026-03-10T22:00:00.000Z");
    const createdAt = new Date("2026-03-08T10:00:00.000Z");
    const now = new Date("2026-03-10T10:00:00.000Z");
    expect(shouldCreateReminder({ createdAt, startAt, now })).toBe(true);
  });
});
