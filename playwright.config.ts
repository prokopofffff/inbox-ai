import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Runs specs from e2e/ against the dev server in MOCK MODE (no DB/keys), which
 * `npm run dev` starts. Chromium only. Requires a one-time browser install:
 *   npx playwright install chromium
 */
export default defineConfig({
  testDir: "e2e",
  // The Next.js dev server compiles routes on-demand; hitting many
  // not-yet-compiled routes in parallel makes first-hit navigations exceed the
  // per-action timeout intermittently. Run serially so each route compile
  // happens under a warm, uncontended server (deterministic, ~30s total).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
