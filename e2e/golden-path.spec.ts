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
 * Demo state is overlay-based (`docs/architecture.md`, `lib/data/load.ts`):
 * completions/dismissals accumulate in `${DATA_DIR}/completions.jsonl` and
 * `${DATA_DIR}/dismissals.jsonl` on top of the committed `data/seed/`. Note:
 * `pnpm demo:reset` (scripts/demo.mjs) resets an unrelated `cases.jsonl`
 * scaffold left over from a different task template — it does not touch these
 * overlays, so it would NOT make this suite repeatable. Deleting the overlay
 * files directly (below) is what actually resets Career Quest demo state.
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

test("golden path: E0028 assessment, top recommendation, complete, HR view", async ({ page }) => {
  await loginAsEmployee(page, "E0028");

  // Step 2: System Design assessed 2 -> effective 3, on the profile's own gap table.
  const gapsSection = page.locator("section", { has: page.getByRole("heading", { name: "Skill gaps toward the target" }) });
  const sdRow = gapsSection.getByRole("row", { name: /System Design/ });
  await expect(sdRow).toBeVisible();
  await expect(sdRow.locator("td").nth(1)).toHaveText("2"); // assessed
  await expect(sdRow.locator("td").nth(2)).toHaveText("3"); // effective

  // Step 3: 1-3 recommendation cards, top pick is a System Design event.
  const recsSection = page.locator("section", { has: page.getByRole("heading", { name: "Recommended next steps" }) });
  const cards = recsSection.locator("> ul > li");
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);

  const topCard = cards.first();
  await expect(topCard.getByRole("heading", { name: "Architecture Review Mentoring" })).toBeVisible();

  await topCard.getByRole("button", { name: "Why this step" }).click();
  const factorRows = topCard.locator("table tbody tr");
  await expect(factorRows.first()).toBeVisible();
  expect(await factorRows.count()).toBeGreaterThanOrEqual(3);
  await expect(topCard.locator("ul li").first()).toBeVisible(); // rule pass/fail list

  // Step 4: Complete -> skill and trajectory move, list refreshes.
  // The page re-renders from the server: the completed step leaves the list and
  // System Design (effective 3 -> 4 = Senior requirement) is no longer a gap.
  await topCard.getByRole("button", { name: "Mark complete" }).click();
  await expect(recsSection.getByRole("heading", { name: "Architecture Review Mentoring" })).toHaveCount(0);
  await expect(gapsSection.getByRole("row", { name: /System Design/ })).toHaveCount(0);
  await expect(cards.first().getByRole("heading")).toBeVisible(); // list refreshed with the next step

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
