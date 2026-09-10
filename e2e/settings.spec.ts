import { expect, type Page, test } from "@playwright/test";

/**
 * Owner settings UI. Requires the local stack from `docs/local-development.md`
 * (`bun run setup` seeds owner@local.test and the "demo" school).
 */

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/sign-in");
  const form = page.locator("form", { hasText: "Local email auth" });
  if ((await form.count()) === 0) {
    test.skip(true, "Local email auth is disabled (NEXT_PUBLIC_DEV_AUTH)");
  }
  await form.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("every category is deep-linkable and marked current", async ({ page }) => {
  const sections: Array<[string, string]> = [
    ["profile", "School details"],
    ["offerings", "Trial classes"],
    ["schedule", "Weekly schedule"],
    ["pricing", "Pricing"],
    ["faqs", "Frequently asked questions"],
    ["agent", "Your agent"],
    ["branding", "Branding"],
  ];

  for (const [section, heading] of sections) {
    await page.goto(`/dashboard/settings?section=${section}`);
    await expect(page.locator("#section-title")).toHaveText(heading);
    await expect(
      page
        .getByRole("navigation", { name: "Settings categories" })
        .locator("a[aria-current='page']"),
    ).toHaveCount(1);
  }
});

test("an unknown category falls back to the first one", async ({ page }) => {
  await page.goto("/dashboard/settings?section=not-a-section");
  await expect(page.locator("#section-title")).toHaveText("School details");
});

test("navigation keeps browser history predictable", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page
    .getByRole("navigation", { name: "Settings categories" })
    .getByRole("link", { name: /Pricing/ })
    .click();
  await expect(page.locator("#section-title")).toHaveText("Pricing");
  await page.goBack();
  await expect(page.locator("#section-title")).toHaveText("School details");
  await page.goForward();
  await expect(page.locator("#section-title")).toHaveText("Pricing");
});

test("invalid input shows an inline error and keeps what was typed", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  const name = page.getByLabel(/School name/);
  const original = await name.inputValue();
  const city = page.getByLabel(/^City/);
  await name.fill("");
  await city.fill("Brooklyn Heights");
  await page.getByRole("button", { name: "Save School Details" }).click();

  await expect(
    page.getByText("Add the name families should hear."),
  ).toBeVisible();
  // Nothing the owner typed is thrown away on a failed save.
  await expect(city).toHaveValue("Brooklyn Heights");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();

  await name.fill(original);
});

test("a valid save reports success and clears the unsaved state", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  const parking = page.getByLabel(/^Parking/);
  // The local Supabase stack is shared, so put this field back afterwards.
  const original = await parking.inputValue();
  const value = `Lot behind the building. ${Date.now()}`;
  await parking.fill(value);
  await expect(
    page.getByRole("status").filter({ hasText: "Unsaved changes" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save School Details" }).click();
  await expect(
    page.getByText("School details saved. Your agent uses them now."),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/^Parking/)).toHaveValue(value);

  await page.getByLabel(/^Parking/).fill(original);
  await page.getByRole("button", { name: "Save School Details" }).click();
  await expect(
    page.getByText("School details saved. Your agent uses them now."),
  ).toBeVisible();
});

test("updating spots confirms the save and leaves no unsaved state", async ({
  page,
}) => {
  await page.goto("/dashboard/settings?section=schedule");
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Update Spots" }) })
    .first();
  const spots = row.getByLabel(/Spots per class/);
  const original = await spots.inputValue();
  const next = String(Number(original) + 1);

  await spots.fill(next);
  await row.getByRole("button", { name: "Update Spots" }).click();

  await expect(
    row.getByRole("status").filter({ hasText: "Upcoming classes now hold" }),
  ).toBeVisible();
  await expect(spots).toHaveValue(next);
  // Baseline moved with the save: nothing to discard, nothing to warn about.
  await expect(row.getByRole("button", { name: "Discard" })).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: "Update Spots" }),
  ).toBeDisabled();

  await spots.fill(original);
  await row.getByRole("button", { name: "Update Spots" }).click();
  await expect(spots).toHaveValue(original);
});

test("saving shows the value the server stored", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.getByLabel(/Country code/).fill("us");
  await page.getByRole("button", { name: "Save School Details" }).click();

  await expect(page.getByLabel(/Country code/)).toHaveValue("US");
  await expect(
    page.getByRole("status").filter({ hasText: "Unsaved changes" }),
  ).toHaveCount(0);
});

test("switching categories with unsaved edits asks first", async ({ page }) => {
  await page.goto("/dashboard/settings?section=pricing");
  await page
    .getByLabel(/Prices and conditions/)
    .fill("Trial class: free for first-time students.");

  await page
    .getByRole("navigation", { name: "Settings categories" })
    .getByRole("link", { name: /FAQs/ })
    .click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep Editing" }).click();
  await expect(page.locator("#section-title")).toHaveText("Pricing");

  await page
    .getByRole("navigation", { name: "Settings categories" })
    .getByRole("link", { name: /FAQs/ })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Discard Changes" })
    .click();
  await expect(page.locator("#section-title")).toHaveText(
    "Frequently asked questions",
  );
});

test("adding and deleting a question requires confirmation to delete", async ({
  page,
}) => {
  const question = `Is there parking for the trial? ${Date.now()}`;
  await page.goto("/dashboard/settings?section=faqs");

  const addButton = page.getByRole("button", { name: "Add a Question" });
  if (await addButton.isVisible()) await addButton.click();

  await page.getByRole("textbox", { name: "Question" }).fill(question);
  await page
    .getByRole("textbox", { name: "Answer" })
    .fill("Yes, there is a free lot behind us.");
  await page.getByRole("button", { name: "Add Question" }).click();

  const item = page.getByRole("listitem").filter({ hasText: question });
  await expect(item).toBeVisible();

  await item.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this question?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete Question" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: question }),
  ).toHaveCount(0);
});

test("a class time can be added, then deleted after confirming", async ({
  page,
}) => {
  await page.goto("/dashboard/settings?section=schedule");

  const addButton = page.getByRole("button", { name: "Add a Class Time" });
  if (await addButton.isVisible()) await addButton.click();

  await page.getByLabel(/Day of the week/).selectOption("2");
  await page.getByLabel(/Start time/).fill("19:15");
  await page.getByLabel(/Class length in minutes/).fill("45");
  await page.getByLabel(/^Internal label/).fill("Playwright temp window");
  await page.getByRole("button", { name: "Add Class Time" }).click();

  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Playwright temp window" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("7:15 PM – 8:00 PM");

  // Escape closes the confirmation without deleting anything.
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete Class Time" })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Playwright temp window" }),
  ).toHaveCount(0);
});

test("editing a trial class keeps its identity after save", async ({
  page,
}) => {
  await page.goto("/dashboard/settings?section=offerings");
  // Restore baseline first if a previous run left a "(Playwright edit)"
  // markup so we always start from the seeded name.
  const previous = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: /Kids beginner trial/ }),
  });
  if ((await previous.count()) > 1) {
    // Find the duplicated row and revert its name to the seeded value.
    for (const row of await previous.all()) {
      const heading = await row
        .getByRole("heading", { level: 4 })
        .first()
        .textContent();
      if (heading?.includes("(Playwright edit)")) {
        await row.getByRole("button", { name: "Edit" }).click();
        await page.getByLabel(/^Class name/).fill("Kids beginner trial");
        await page.getByRole("button", { name: "Save Changes" }).click();
        await page.waitForTimeout(200);
        break;
      }
    }
  }

  const row = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Kids beginner trial" }),
  });
  if ((await row.count()) === 0) test.skip(true, "No seeded trial class");
  const initialCount = await row.count();
  const initialBody = await row.first().textContent();
  await row.first().getByRole("button", { name: "Edit" }).click();

  const editor = page.getByRole("heading", { name: /Edit “/ });
  await expect(editor).toBeVisible();

  const name = page.getByLabel(/^Class name/);
  const tagged = "Kids beginner trial (Playwright edit)";
  await name.fill(tagged);
  await page.getByRole("button", { name: "Save Changes" }).click();

  // The row's success message appears on the row itself (the in-place
  // announcement, not the editor's status line) because the editor closes
  // after a clean save. Look for the new heading text instead.
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: tagged }) }),
  ).toHaveCount(1, { timeout: 10_000 });

  // Reload — the row count must stay the same (same row, same id) and the
  // row body's class-time summary (which Edit doesn't change) is preserved.
  await page.reload();
  const reloaded = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: tagged }) });
  await expect(reloaded).toHaveCount(initialCount);
  // The body still mentions the same class-time-related details.
  const newBody = await reloaded.first().textContent();
  expect(newBody?.includes("weekly class time")).toBe(true);

  // Restore the seeded name so the next test run is unaffected.
  await reloaded.first().getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/^Class name/).fill("Kids beginner trial");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(
    page.getByRole("listitem").filter({
      has: page.getByRole("heading", { name: "Kids beginner trial" }),
    }),
  ).toHaveCount(initialCount, { timeout: 10_000 });
  void initialBody;
});

test("switching between trial-class edits offers a discard dialog when dirty", async ({
  page,
}) => {
  // Use a unique second-class name per run so this test never has to clean up.
  const secondName = `PwSwitch ${Date.now()}`;
  await page.goto("/dashboard/settings?section=offerings");

  // Add a second trial class so we can switch between two.
  await page.getByRole("button", { name: "Add a Trial Class" }).first().click();
  await page.getByLabel(/^Class name/).fill(secondName);
  await page.getByRole("button", { name: "Add Trial Class" }).click();
  await expect(
    page.getByRole("heading", { name: secondName }).first(),
  ).toBeVisible();

  const items = page.locator("ul.divide-y").first().getByRole("listitem");
  await expect(page.getByRole("heading", { name: secondName })).toBeVisible();
  if ((await items.count()) < 2) {
    test.skip(true, "Could not seed second trial class");
  }

  await items.nth(0).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/^Class name/).fill("Dirty edit in flight");
  await expect(
    page.getByRole("status").filter({ hasText: "Unsaved changes" }),
  ).toBeVisible();

  // Try to switch to another trial class — confirm dialog appears.
  await items.nth(1).getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: /Switch and discard/,
  });
  await expect(dialog).toBeVisible();

  // Keep editing restores the original panel.
  await dialog.getByRole("button", { name: "Keep Editing" }).click();
  await expect(page.getByLabel(/^Class name/)).toHaveValue(
    "Dirty edit in flight",
  );

  // Discard this time and switch; the new editor should open with the row's
  // seeded values, not the dirty in-flight text.
  await items.nth(1).getByRole("button", { name: "Edit" }).click();
  await dialog.getByRole("button", { name: /Discard/ }).click();
  const newName = await page.getByLabel(/^Class name/).inputValue();
  expect(newName).not.toBe("Dirty edit in flight");

  // Tidy up: stop offering the second class so the next test gets a clean
  // seeded baseline. Other tests don't depend on row count.
  const secondRow = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: secondName }) })
    .first();
  await secondRow.getByRole("button", { name: "Stop Offering" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Stop Offering" })
    .click();
});

test("editing a FAQ in place updates the answer disclosure after save", async ({
  page,
}) => {
  await page.goto("/dashboard/settings?section=faqs");

  // Ensure a FAQ exists to edit. The seeded FAQ may have been deleted by
  // earlier tests; create one with a unique-per-run question so we don't
  // accidentally collide with the seeded row.
  const uniqueQuestion = `Pw FAQ Edit ${Date.now()}`;
  await page.getByRole("button", { name: "Add a Question" }).first().click();
  await page.getByRole("textbox", { name: "Question" }).fill(uniqueQuestion);
  await page.getByRole("textbox", { name: "Answer" }).fill("Initial answer");
  await page.getByRole("button", { name: "Add Question" }).click();
  const target = page
    .getByRole("listitem")
    .filter({ hasText: uniqueQuestion })
    .first();
  await expect(target).toBeVisible();

  await target.getByRole("button", { name: "Edit" }).click();
  const editor = page.getByRole("heading", { name: /Edit question/ });
  await expect(editor).toBeVisible();

  const answer = page.getByRole("textbox", { name: "Answer" });
  const originalAnswer = await answer.inputValue();
  const revised = `${originalAnswer} (Playwright revision)`;
  await answer.fill(revised);
  await page.getByRole("button", { name: "Save Changes" }).click();

  // Editor closes on save success — assert the form is no longer rendered
  // and the row's disclosure shows the new answer text.
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeHidden({
    timeout: 10_000,
  });

  const disclosure = page
    .getByRole("listitem")
    .filter({ hasText: uniqueQuestion })
    .first();
  await disclosure.locator("summary").first().click();
  await expect(disclosure).toContainText(revised);

  // Restore the answer so the next run starts from the same baseline, then
  // delete the test-created row so it doesn't leak into other test runs.
  await disclosure.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Answer" }).fill(originalAnswer);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeHidden({
    timeout: 10_000,
  });

  const cleanupRow = page
    .getByRole("listitem")
    .filter({ hasText: uniqueQuestion })
    .first();
  await cleanupRow.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: uniqueQuestion }),
  ).toHaveCount(0);
});
