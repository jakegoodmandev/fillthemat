import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionNames = [
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
] as const;

const source = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/settings/actions.ts"),
  "utf8",
);

describe("settings action authorization", () => {
  for (const [index, actionName] of actionNames.entries()) {
    it(`${actionName} requires the owned school`, () => {
      const start = source.indexOf(`export async function ${actionName}`);
      const nextName = actionNames[index + 1];
      const end = nextName
        ? source.indexOf(`export async function ${nextName}`)
        : source.length;
      const actionSource = source.slice(start, end);

      expect(start).toBeGreaterThan(-1);
      expect(actionSource).toContain("await requireOwnedSchool()");
      expect(actionSource).toContain("school.id");
    });
  }
});
