import { expect, test } from "@playwright/test";

/**
 * Automation ("/automation") — the rules list, per-rule enable/disable toggle,
 * and the rule builder. In MOCK MODE the page renders seeded EXAMPLE_RULES
 * (Invoice Detection, Refund Requests, …) from app/(dashboard)/automation/page.tsx.
 *
 * NOTE: the builder's stage labels render as "IF" / "THEN" (not "When" / "Then")
 * in the current UI — see the StagePill usage in rule-dialog.tsx.
 */
test.describe("Automation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/automation");
  });

  test("lists automation rules", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Automation Rules" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Active Rules" })
    ).toBeVisible();

    // Seeded example rules.
    await expect(page.getByText("Invoice Detection")).toBeVisible();
    await expect(page.getByText("Refund Requests")).toBeVisible();
  });

  test("each rule exposes an enable/disable toggle", async ({ page }) => {
    // Switches carry an aria-label of "Enable rule" / "Disable rule".
    const toggle = page
      .getByRole("switch", { name: /(Enable|Disable) rule/ })
      .first();
    await expect(toggle).toBeVisible();
  });

  test("the inline rule builder shows the IF/THEN stages", async ({ page }) => {
    // The Rule Builder panel is rendered inline on the page.
    await expect(
      page.getByRole("heading", { name: "Rule Builder" })
    ).toBeVisible();
    await expect(page.getByText("Create a new automation")).toBeVisible();

    // Builder stage pills + fields.
    await expect(page.getByText("IF", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("THEN", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Field", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Action", { exact: true }).first()
    ).toBeVisible();
  });

  test("opening the New Rule dialog shows the IF/THEN builder", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /New Rule/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New rule" })
    ).toBeVisible();
    await expect(dialog.getByText("IF", { exact: true })).toBeVisible();
    await expect(dialog.getByText("THEN", { exact: true })).toBeVisible();
  });
});
