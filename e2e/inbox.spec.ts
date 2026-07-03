import { expect, test } from "@playwright/test";

/**
 * Inbox ("/inbox") — list + tabs, opening an email into the detail pane, and
 * the URL-driven search filter. MOCK MODE seeds emails as "mock-0", "mock-1",
 * … (see lib/mock-emails), so the first row links to /inbox/mock-0.
 */
test.describe("Inbox", () => {
  test("shows the list header and the All/Unread/Assigned tabs", async ({
    page,
  }) => {
    await page.goto("/inbox");

    await expect(
      page.getByRole("heading", { name: "Inbox", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("AI-triaged and prioritized automatically")
    ).toBeVisible();

    // View tabs (buttons) in the left pane.
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unread" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assigned" })).toBeVisible();

    // At least one email row is present.
    await expect(
      page.locator('a[href^="/inbox/mock-"]').first()
    ).toBeVisible();
  });

  test("opening the first email shows the AI Summary and detail actions", async ({
    page,
  }) => {
    await page.goto("/inbox");

    const firstRow = page.locator('a[href^="/inbox/mock-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Landed on a detail route.
    await expect(page).toHaveURL(/\/inbox\/mock-/);

    // AI Summary section (from components/inbox/email-detail.tsx).
    await expect(page.getByText("AI SUMMARY")).toBeVisible();
    await expect(page.getByText("ORIGINAL MESSAGE")).toBeVisible();
    await expect(page.getByText("SUGGESTED REPLY")).toBeVisible();

    // Primary actions. The AI "analyze"-style action here is Regenerate
    // (re-runs the model to produce a fresh suggested reply); there is no
    // separate "Analyze" button in the current UI.
    // Exact match: a separate "Use this reply" button also contains "Reply".
    await expect(
      page.getByRole("button", { name: "Reply", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Regenerate" })
    ).toBeVisible();
    // Two "Archive" affordances exist (icon button + labelled button); assert
    // at least one is visible.
    await expect(
      page.getByRole("button", { name: "Archive" }).first()
    ).toBeVisible();
  });

  test("typing in search updates the ?q= query param", async ({ page }) => {
    await page.goto("/inbox");

    const search = page.getByRole("searchbox", { name: "Search emails" });
    await expect(search).toBeVisible();
    await search.fill("refund");

    // The list debounces the input into the URL (?q=refund).
    await expect(page).toHaveURL(/[?&]q=refund/, { timeout: 5000 });
  });
});
