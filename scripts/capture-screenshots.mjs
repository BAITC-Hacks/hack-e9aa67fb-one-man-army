#!/usr/bin/env node
/**
 * Deterministic demo screenshots from the REAL running application.
 *
 * Never hand-edit the output and never stage a result the product cannot
 * produce. A fabricated screenshot is a different category of problem from a
 * missing feature.
 *
 * Usage:
 *   pnpm demo:reset && pnpm dev &        # app must be running and seeded
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "artifacts", "screenshots");

/**
 * Edit this list for the actual challenge. Each step names the file, the route,
 * and a locator that must be visible before the shot - never a fixed sleep,
 * which is the usual source of flaky or half-rendered screenshots.
 */
const STEPS = [
  { file: "01-home.png", path: "/", waitFor: "main" },
  // { file: "02-input.png", path: "/submit", waitFor: "form",
  //   act: async (page) => {
  //     await page.getByLabel("Description").fill("Streetlight out on Abay 12");
  //   } },
  // { file: "03-agent-action.png", path: "/submit", waitFor: "[data-testid=trace]",
  //   act: async (page) => { await page.getByRole("button", { name: "Submit" }).click(); } },
  // { file: "04-result.png", path: "/cases/demo-001", waitFor: "[data-testid=decision]" },
  // { file: "05-audit-or-evidence.png", path: "/cases/demo-001/audit", waitFor: "[data-testid=audit]" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "ru-RU",
  timezoneId: "Asia/Almaty",
});
const page = await context.newPage();

mkdirSync(OUT, { recursive: true });

let captured = 0;
let failed = 0;

for (const step of STEPS) {
  try {
    await page.goto(`${BASE}${step.path}`, { waitUntil: "networkidle", timeout: 15000 });
    if (step.act) await step.act(page);
    if (step.waitFor) {
      await page.locator(step.waitFor).first().waitFor({ state: "visible", timeout: 15000 });
    }
    await page.screenshot({ path: join(OUT, step.file), fullPage: false });
    console.log(`  captured ${step.file}`);
    captured++;
  } catch (error) {
    console.error(`  FAILED  ${step.file}: ${error.message}`);
    failed++;
  }
}

await browser.close();

console.log(`\n${captured} captured, ${failed} failed -> artifacts/screenshots/`);
if (failed > 0) {
  console.error("Some screenshots failed. Do NOT substitute a mockup - fix the app or drop the shot.");
  process.exit(1);
}
