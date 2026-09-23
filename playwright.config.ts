import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * `testDir: "./e2e"` is load-bearing: without it Playwright also collects
 * `tests/*.test.ts`, which are Vitest files, and fails with "No tests found"
 * after a confusing stack trace. Vitest is scoped to `tests/` for the same
 * reason (see vitest.config.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  // Two solid tests beat twenty flaky ones; a red suite at T+04:45 costs more
  // time than it saves.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.DEMO_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Deterministic for screenshots and for locale-sensitive assertions.
    viewport: { width: 1440, height: 900 },
    locale: "ru-RU",
    timezoneId: "Asia/Almaty",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Starts the app if it is not already running, so `pnpm test:e2e` works from
  // a clean checkout. MODEL_REF stays offline so results never depend on a key.
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Pin the committed seed so local runs match a judge's clean clone (the
    // organizer kit, when present locally, would otherwise be preferred).
    env: { MODEL_REF: "mock:demo", DATASET_DIR: "data/seed", DATA_DIR: "data/e2e-store" },
  },
});
