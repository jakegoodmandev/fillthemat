import { describe, expect, it } from "vitest";
import { runBookingAgentToCompletion } from "./run-agent";

// The local AI stub is active in tests (no VERCEL_OIDC_TOKEN, NODE_ENV test),
// so this exercises the deterministic no-model path and asserts the capture
// seam's shape without a network call.
describe("runBookingAgentToCompletion (local stub)", () => {
  const school = {
    id: "school-1",
    name: "Demo Dojo",
    slug: "demo",
    timezone: "America/New_York",
    notificationEmail: "owner@local.test",
    // minimal shape sufficient for the stub branch
  } as never;

  it("returns text plus empty captures for the stub path", async () => {
    const result = await runBookingAgentToCompletion({
      school,
      offerings: [],
      windows: [],
      occurrences: [],
      faqs: [],
      uiMessages: [
        { id: "wamid.1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      ],
      now: new Date(),
    });
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.prepareBooking).toBeNull();
    expect(result.lead).toBeNull();
  });
});
