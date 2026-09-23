import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regression test for the stale-cache bug: `getDataset()` used to memoize in
 * a module-scope variable, which is safe within a single call chain but is
 * exactly the pattern that broke across Next.js's separate route/page
 * bundles in production (a completion written via the API route never
 * invalidated the copy the page's render read from). This test exercises the
 * real chain end to end - real files under a temp DATA_DIR, no mocks - so a
 * regression here means `getDataset()` is caching again.
 */
process.env.DATASET_DIR = join(process.cwd(), "data/seed");
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "progress-integration-"));

describe("complete -> re-fetch -> effective moves", () => {
  it("a completion written by completeEvent is visible to the very next getDataset() call", async () => {
    const { completeEvent } = await import("@/lib/domain/progress");
    const { getDataset } = await import("@/lib/data/load");
    const { effectiveSkills } = await import("@/lib/domain/effective");

    // E0028 (data/seed): assessed SK_SYSTEM_DESIGN 2, last_review_date
    // 2026-06-24, a post-review completed EV_006 already lifts effective to
    // 3. EV_016 (gain 1, max 4) is the top recommendation and should push it
    // to 4 once completed - as a *separate* getDataset() call would see it,
    // mirroring the page re-render after the API route's mutation.
    const before = await getDataset();
    const empBefore = before.employees.find((e) => e.employee_id === "E0028");
    expect(empBefore).toBeDefined();
    if (!empBefore) throw new Error("unreachable");
    expect(effectiveSkills(empBefore, before.history, before.events).effective.SK_SYSTEM_DESIGN).toBe(3);

    await completeEvent("E0028", "EV_016", { role: "employee", id: "E0028" });

    const after = await getDataset();
    const empAfter = after.employees.find((e) => e.employee_id === "E0028");
    expect(empAfter).toBeDefined();
    if (!empAfter) throw new Error("unreachable");
    expect(effectiveSkills(empAfter, after.history, after.events).effective.SK_SYSTEM_DESIGN).toBe(4);
  });
});
