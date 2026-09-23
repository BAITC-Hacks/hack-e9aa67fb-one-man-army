import { test, expect } from "@playwright/test";

/**
 * The golden path: the one scenario that proves the product works.
 *
 * Replace the body once the challenge is known, but keep the shape:
 *   1. one test that walks the demo exactly as the operator will
 *   2. one test for a failure path a judge will click
 *
 * Prefer getByRole / getByLabel over CSS selectors - they survive restyling and
 * double as an accessibility check.
 */

test("app is alive and reports offline mode", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    status: string;
    model: { offline: boolean };
  };
  expect(body.status).toBe("ok");
  // The demo must not depend on credentials a judge does not have.
  expect(body.model.offline).toBe(true);
});

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

// test("golden path: <scenario>", async ({ page }) => {
//   await page.goto("/");
//   await page.getByLabel("Description").fill("...");
//   await page.getByRole("button", { name: "Submit" }).click();
//   await expect(page.getByTestId("decision")).toBeVisible();
// });
