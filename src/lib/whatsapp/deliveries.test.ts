import { addHours, subHours } from "date-fns";
import { describe, expect, it } from "vitest";
import { planWhatsAppDelivery, type WhatsappDeliveryPlan } from "./deliveries";

const now = new Date("2026-09-11T12:00:00Z");

describe("planWhatsAppDelivery", () => {
  it("prefers an explicit template even inside the window", () => {
    const plan = planWhatsAppDelivery(
      {
        templateName: "booking_confirmation",
        templateParams: ["Demo Dojo", "Sam"],
        windowExpiresAt: addHours(now, 2),
      },
      now,
    );
    expect(plan.type).toBe("template");
    if (plan.type === "template") {
      expect(plan.templateName).toBe("booking_confirmation");
      expect(plan.params).toEqual(["Demo Dojo", "Sam"]);
    }
  });

  it("sends free-form text while the 24h window is open", () => {
    const plan = planWhatsAppDelivery(
      {
        templateName: null,
        templateParams: null,
        windowExpiresAt: addHours(now, 1),
      },
      now,
    );
    expect(plan).toEqual({ type: "text" } satisfies WhatsappDeliveryPlan);
  });

  it("fails closed when the window is closed and no template is set", () => {
    const plan = planWhatsAppDelivery(
      {
        templateName: null,
        templateParams: null,
        windowExpiresAt: subHours(now, 1),
      },
      now,
    );
    expect(plan).toEqual({ type: "window_closed" });
  });

  it("sends a template regardless of a closed window", () => {
    const plan = planWhatsAppDelivery(
      {
        templateName: "booking_reminder",
        templateParams: ["Demo Dojo", "Sam", "Monday"],
        windowExpiresAt: subHours(now, 1),
      },
      now,
    );
    expect(plan.type).toBe("template");
  });
});
