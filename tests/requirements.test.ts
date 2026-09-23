/**
 * Acceptance-criteria tests, one block per requirement id
 * (docs/requirements.md R-03, R-04, R-05, R-10), run against every employee in the loaded dataset (the organizer
 * kit when present, else the committed seed) so the property is checked, not a hand-picked case.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getDataset, type Dataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { applyGrowth } from "@/lib/domain/growth";

describe("R-03: recommendation count is 1-3, or 0 with a reason, for every employee in the loaded dataset (200 with the organizer kit, 40 with the committed seed)", () => {
  let ds: Dataset;

  beforeAll(async () => {
    ds = await getDataset();
  });

  it("every employee gets between 0 and 3 recommendations", () => {
    expect(ds.employees.length).toBeGreaterThan(0);
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(result.recommendations.length).toBeLessThanOrEqual(3);
    }
  });

  it("0 recommendations always carries an explicit noStep reason (R-07)", () => {
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      if (result.recommendations.length === 0) {
        expect(result.noStep).not.toBeNull();
        expect(typeof result.noStep).toBe("string");
      } else {
        expect(result.noStep).toBeNull();
      }
    }
  });

  it("is deterministic: calling recommend() twice for the same employee and dataset gives the same ordered result", () => {
    const sample = ds.employees.slice(0, 30);
    for (const emp of sample) {
      const first = recommend(emp.employee_id, ds);
      const second = recommend(emp.employee_id, ds);
      expect(second.recommendations.map((r) => r.event_id)).toEqual(first.recommendations.map((r) => r.event_id));
      expect(second.noStep).toBe(first.noStep);
      expect(second.recommendations.map((r) => r.score)).toEqual(first.recommendations.map((r) => r.score));
    }
  });
});

describe("R-04: every recommendation rationale has >=3 distinct factor kinds", () => {
  it("holds for every recommendation across every loaded employee", async () => {
    const ds = await getDataset();
    let totalRecommendations = 0;
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      for (const rec of result.recommendations) {
        totalRecommendations++;
        const kinds = new Set(rec.factors.map((f) => f.kind));
        expect(kinds.size).toBeGreaterThanOrEqual(3);
      }
    }
    // Sanity: the property must have had cases to check, not vacuously passed.
    expect(totalRecommendations).toBeGreaterThan(0);
  });
});

describe("R-05: completion growth is min(current+gain, max_level), and never decreases", () => {
  it("caps at max_level", () => {
    expect(applyGrowth(3, 1, 4)).toBe(4);
  });

  it("no-op when already at (or above) max_level", () => {
    expect(applyGrowth(4, 1, 4)).toBe(4);
    expect(applyGrowth(5, 1, 4)).toBe(5); // never decreases even if current exceeds max
  });

  it("missing skill starts at 0 and grows normally", () => {
    expect(applyGrowth(0, 1, 5)).toBe(1);
  });
});

describe("R-10: recommendation latency budget, measured across every loaded profile", () => {
  it("computing recommendations for every employee completes within 10s total", async () => {
    const ds = await getDataset();
    const start = performance.now();
    for (const emp of ds.employees) {
      recommend(emp.employee_id, ds);
    }
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`R-10: recommend() for ${ds.employees.length} employees took ${elapsedMs.toFixed(1)}ms total`);
    expect(elapsedMs).toBeLessThan(10000);
  });
});
