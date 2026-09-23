import { test, expect, type Page } from "@playwright/test";
import { rmSync } from "node:fs";
import { join } from "node:path";

// The product defaults to Russian; selectors below use the English copy, so
// pin the UI language explicitly rather than depend on the default.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "en", url: baseURL ?? "http://localhost:3000" }]);
});

/**
 * The golden path: the one scenario that proves the product works, matching
 * README.md §5 "Main user scenario — procedure for checking it".
 *
 * Dataset: the committed organizer kit (docs/task/career_quest_dataset/),
 * the app's own default (lib/data/load.ts) - the same dataset a judge's
 * clean clone runs, since playwright.config.ts no longer pins DATASET_DIR.
 *
 * Demo state is overlay-based (`docs/architecture.md`, `lib/data/load.ts`):
 * completions/dismissals/imports accumulate in `${DATA_DIR}` on top of the
 * read-only kit. Deleting the overlay files below is what resets state
 * between runs; `pnpm demo:reset` targets an unrelated scaffold.
 */
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");

test.beforeAll(() => {
  for (const file of ["completions.jsonl", "dismissals.jsonl", "imports.json"]) {
    rmSync(join(DATA_DIR, file), { force: true });
  }
});

test("app is alive and reports offline mode", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    status: string;
    model: { offline: boolean };
  };
  expect(body.status).toBe("ok");
  expect(body.model.offline).toBe(true);
});

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

async function loginAsEmployee(page: Page, employeeId: string) {
  await page.goto("/login");
  await page.locator("#employee-id").selectOption(employeeId);
  await page.getByRole("button", { name: "Continue as employee" }).click();
  await expect(page).toHaveURL(new RegExp(`/employee/${employeeId}$`));
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("golden path: E0137 assessment, top recommendation, complete, HR view", async ({ page }) => {
  await loginAsEmployee(page, "E0137");

  // Step 2: System Design assessed 2, effective 2 (critical gap), on the
  // profile's own gap table (kit values: docs/task/career_quest_dataset/
  // employees.json E0137). This is the row the top recommendation closes.
  const gapsSection = page.locator("section", { has: page.getByRole("heading", { name: "Skill gaps toward the target" }) });
  const sdRow = gapsSection.getByRole("row", { name: /System Design/ });
  await expect(sdRow).toBeVisible();
  await expect(sdRow.locator("td").nth(1)).toHaveText("2"); // assessed
  await expect(sdRow.locator("td").nth(2)).toHaveText("2"); // effective, before completion

  // Step 3: 1-3 recommendation cards (E0137 has 3: a critical-gap closer,
  // a self-paced cert, and a format-switch alternative - docs/review-final-2.md #3).
  const recsSection = page.locator("section", { has: page.getByRole("heading", { name: "Recommended next steps" }) });
  const cards = recsSection.locator("> ul > li");
  const countBefore = await cards.count();
  expect(countBefore).toBeGreaterThanOrEqual(1);
  expect(countBefore).toBeLessThanOrEqual(3);

  const topCard = cards.first();
  const topHeading = topCard.getByRole("heading");
  const topTitle = await topHeading.textContent();
  expect(topTitle).toBeTruthy();

  // Explanation trace: >=3 factor kinds and a source badge (mock, offline).
  await topCard.getByRole("button", { name: "How was this chosen?" }).click();
  const factorRows = topCard.locator("table tbody tr");
  await expect(factorRows.first()).toBeVisible();
  expect(await factorRows.count()).toBeGreaterThanOrEqual(3);
  await expect(topCard.locator("ul li").first()).toBeVisible(); // rule pass/fail list
  await expect(topCard.getByText("Demo model (offline, not a live AI)")).toBeVisible();

  // Step 4: Complete -> observable change: the completed step's heading
  // leaves the list, and the list either shrinks or refreshes with a
  // different top card (which event ranks next depends on the scoring
  // engine, so this does not assert a hard-coded next title).
  await topCard.getByRole("button", { name: "Mark complete" }).click();
  await expect(recsSection.getByRole("heading", { name: topTitle! })).toHaveCount(0);
  const countAfter = await cards.count();
  if (countAfter === countBefore) {
    const newTopTitle = await cards.first().getByRole("heading").textContent();
    expect(newTopTitle).not.toBe(topTitle);
  } else {
    expect(countAfter).toBe(Math.max(countBefore - 1, 0));
  }

  // Step 4b: the closed gap's row changes - System Design effective moves
  // from 2 to 3 (still below the required 4, but the completion registered).
  await expect(sdRow.locator("td").nth(2)).toHaveText("3");

  // Step 5: log out, log in as HR, three panels.
  await logout(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as HR" }).click();
  await expect(page).toHaveURL(/\/hr$/);

  await expect(page.getByRole("heading", { name: "Lagging skills" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employees with no recommended step" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Participation by activity" })).toBeVisible();
});

test("failure path: an employee cannot open another employee's profile", async ({ page }) => {
  await loginAsEmployee(page, "E0028");
  await page.goto("/employee/E0001");
  await expect(page.getByRole("heading", { name: "This profile isn't yours" })).toBeVisible();
});

test("HR import: a new employee from a fixture shows up with recommendations", async ({ page }) => {
  // trap-F01 uses employee_id T9001, which does not collide with any kit
  // E0xxx id, so the import is additive rather than a merge/overwrite.
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as HR" }).click();
  await expect(page).toHaveURL(/\/hr$/);

  await page.goto("/hr/import");
  await page.setInputFiles("#employees", "data/fixtures/trap-F01.json");
  await page.setInputFiles("#activity_history", "data/fixtures/trap-F01.csv");
  await page.getByRole("button", { name: "Upload" }).click();

  await expect(page.getByRole("heading", { name: "Import report" })).toBeVisible();

  await loginAsEmployee(page, "T9001");
  const recsSection = page.locator("section", { has: page.getByRole("heading", { name: "Recommended next steps" }) });
  await expect(recsSection).toBeVisible();
});
