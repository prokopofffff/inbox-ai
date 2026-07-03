import { expect, test } from "@playwright/test";

/**
 * AI Insights ("/ai-insights") — the six insight cards plus the mock average
 * response time ("1h 42m"). MOCK MODE serves deterministic insight data from
 * components/ai-insights/data.ts.
 */
test.describe("AI Insights", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-insights");
  });

  test("renders the page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "AI Insights", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Patterns and recommendations generated from your inbox")
    ).toBeVisible();
  });

  test("renders all six insight cards", async ({ page }) => {
    for (const title of [
      "Top Customer Issues",
      "Most Common Questions",
      "Repeated Complaints",
      "Urgent Cases",
      "Average Response Time",
      "AI Suggestions",
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test("shows the mock average response time", async ({ page }) => {
    await expect(page.getByText("1h 42m", { exact: true })).toBeVisible();
    // Supporting metrics on the response-time card.
    await expect(page.getByText("First response")).toBeVisible();
    await expect(page.getByText(/faster/)).toBeVisible();
  });
});
