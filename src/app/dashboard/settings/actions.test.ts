import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

const MUTATIONS = [
  "updateProfileAction",
  "updatePricingAction",
  "updateAgentAction",
  "updateBrandingAction",
  "createOfferingAction",
  "toggleOfferingAction",
  "createWindowAction",
  "deactivateWindowAction",
  "updateWindowCapacityAction",
  "deleteWindowAction",
  "createFaqAction",
  "deleteFaqAction",
];

describe("settings server actions", () => {
  it("keeps requireOwnedSchool on every mutation", () => {
    for (const name of MUTATIONS) {
      const start = SOURCE.indexOf(`export async function ${name}`);
      expect(start, name).toBeGreaterThan(-1);
      const next = SOURCE.indexOf("export async function", start + 10);
      const body = SOURCE.slice(start, next === -1 ? undefined : next);
      expect(body).toContain("requireOwnedSchool()");
    }
  });

  it("revalidates the settings layout after a successful save", () => {
    expect(SOURCE).toContain('revalidatePath("/dashboard/settings", "layout")');
  });

  it("returns structured success and error states instead of failing silently", () => {
    expect(SOURCE).toContain("successState(");
    expect(SOURCE).toContain("errorState(");
    expect(SOURCE).not.toMatch(
      /if \(!name \|\| !notificationEmail\.success\) return;/,
    );
  });
});
