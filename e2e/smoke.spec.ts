import { expect, test } from "@playwright/test";

test("signed-out home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toContainText("trial classes");
});
