import { expect, test } from "@playwright/test";

/**
 * Sidebar navigation. At the default Desktop Chrome viewport the persistent
 * sidebar (hidden on mobile, `md:flex`) is visible, exposing links to
 * Dashboard / Inbox / AI Insights / Rules / Settings (see NAV_ITEMS in
 * components/app-sidebar.tsx).
 *
 * We start from /inbox (a page that renders the dashboard shell) rather than
 * "/", because a leftover boilerplate app/page.tsx currently shadows the
 * dashboard route at "/".
 */
test.describe("Sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/inbox");
  });

  /** The desktop sidebar nav landmark. */
  function sidebar(page: import("@playwright/test").Page) {
    return page.getByRole("navigation").first();
  }

  test("navigates to Inbox", async ({ page }) => {
    // Start elsewhere first so the click is a real navigation.
    await page.goto("/automation");
    await sidebar(page).getByRole("link", { name: "Inbox" }).click();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(
      page.getByRole("heading", { name: "Inbox", exact: true })
    ).toBeVisible();
  });

  test("navigates to AI Insights", async ({ page }) => {
    await sidebar(page).getByRole("link", { name: "AI Insights" }).click();
    await expect(page).toHaveURL(/\/ai-insights$/);
    await expect(
      page.getByRole("heading", { name: "AI Insights", exact: true })
    ).toBeVisible();
  });

  test("navigates to Rules (automation)", async ({ page }) => {
    await sidebar(page).getByRole("link", { name: "Rules" }).click();
    await expect(page).toHaveURL(/\/automation$/);
    await expect(
      page.getByRole("heading", { name: "Automation Rules" })
    ).toBeVisible();
  });

  test("navigates to Settings", async ({ page }) => {
    await sidebar(page).getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("Dashboard link points at the root route", async ({ page }) => {
    const dashboard = sidebar(page).getByRole("link", { name: "Dashboard" });
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute("href", "/");
    await dashboard.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
