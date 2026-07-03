import { expect, test } from "@playwright/test";

/**
 * Dashboard ("/") — headline stats, category/priority charts, and recent
 * activity. Runs against the app in MOCK MODE (no DB/keys), where the dashboard
 * data comes from deterministic mock aggregates.
 *
 * NOTE: There is a known route conflict in the repo — a leftover Next.js
 * boilerplate `app/page.tsx` shadows `app/(dashboard)/page.tsx`, so "/" may
 * render the starter template instead of the dashboard. These assertions target
 * the *intended* dashboard content; if they fail at "/", that boilerplate page
 * needs to be removed so the dashboard route resolves.
 */
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the four headline stat cards", async ({ page }) => {
    // Labels come from components/dashboard/stat-cards.tsx.
    await expect(
      page.getByText("Total Emails Today", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("High Priority", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Waiting for Reply", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Automatically Resolved", { exact: true })
    ).toBeVisible();
  });

  test("renders the category and priority chart sections", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Emails by Category" })
    ).toBeVisible();
    await expect(
      page.getByText("Distribution across triage labels")
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Priority Distribution" })
    ).toBeVisible();
    await expect(
      page.getByText("How incoming email is prioritized")
    ).toBeVisible();

    // Priority donut legend buckets. Scope to the legend list so we don't
    // collide with the same words appearing as priority badges elsewhere on
    // the page (e.g. the Recent Activity panel).
    const legend = page.getByRole("list").filter({ hasText: "High" });
    await expect(legend.getByText("High", { exact: true })).toBeVisible();
    await expect(legend.getByText("Medium", { exact: true })).toBeVisible();
    await expect(legend.getByText("Low", { exact: true })).toBeVisible();
  });

  test("renders the Recent Activity panel", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Recent Activity" })
    ).toBeVisible();
    await expect(
      page.getByText("Latest emails classified by AI")
    ).toBeVisible();
    // "View all" links through to the inbox.
    await expect(page.getByRole("link", { name: /View all/i })).toBeVisible();
  });
});
