/**
 * R-10 latency acceptance: UI-facing reads <=2s, AI recommendation explain
 * <=10s with an 8s fallback timeout. Runs on the committed kit dataset
 * (docs/task/career_quest_dataset, the default resolved by lib/data/load.ts)
 * so the numbers below are the ones the README can cite.
 */
import { describe, expect, it } from "vitest";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { getDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { trajectory } from "@/lib/domain/trajectory";
import { gradePath } from "@/lib/domain/gradePath";
import { hrAggregates } from "@/lib/domain/hr";
import { explain, EXPLAIN_TIMEOUT_MS } from "@/lib/ai/explain";
import type { Recommendation } from "@/lib/contracts";

const UI_BUDGET_MS = 2000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

describe("R-10 latency: per-employee reads (getDataset + recommend + trajectory + gradePath)", () => {
  it("every one of the 200 kit employees resolves well under the 2s UI budget", async () => {
    const loadStart = performance.now();
    const ds = await getDataset();
    const loadMs = performance.now() - loadStart;
    expect(ds.employees.length).toBe(200);
    expect(loadMs).toBeLessThan(UI_BUDGET_MS);

    const perEmployeeMs: number[] = [];
    for (const emp of ds.employees) {
      const start = performance.now();
      try {
        recommend(emp.employee_id, ds);
        trajectory(emp, ds);
        gradePath(emp, ds);
      } catch {
        // A minority of kit rows are intentionally incomplete profiles (the
        // page's own try/catch handles this in production); the throw itself
        // is still part of the timed request path, so it is timed, not skipped.
      }
      perEmployeeMs.push(performance.now() - start);
    }

    const sorted = [...perEmployeeMs].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    const max = sorted[sorted.length - 1] ?? 0;
    const mean = perEmployeeMs.reduce((a, b) => a + b, 0) / perEmployeeMs.length;

    console.info(
      `[R-10] getDataset: ${loadMs.toFixed(2)}ms | per-employee (n=${perEmployeeMs.length}) ` +
        `mean=${mean.toFixed(3)}ms p95=${p95.toFixed(3)}ms max=${max.toFixed(3)}ms (budget ${UI_BUDGET_MS}ms)`,
    );

    expect(p95).toBeLessThan(UI_BUDGET_MS);
    expect(max).toBeLessThan(UI_BUDGET_MS);
  });
});

describe("R-10 latency: HR aggregates", () => {
  it("hrAggregates over the full kit dataset resolves well under the 2s UI budget", async () => {
    const ds = await getDataset();
    const start = performance.now();
    const result = hrAggregates(ds);
    const elapsedMs = performance.now() - start;

    console.info(`[R-10] hrAggregates: ${elapsedMs.toFixed(2)}ms (budget ${UI_BUDGET_MS}ms)`);

    expect(result).toBeDefined();
    expect(elapsedMs).toBeLessThan(UI_BUDGET_MS);
  });
});

describe("R-10 latency: explain() fallback on a hanging provider", () => {
  const rec: Recommendation = {
    event_id: "EV_LAT",
    title: "Latency Test Workshop",
    type: "workshop",
    format: "offline",
    duration_hours: 8,
    next_session: "2026-10-01",
    score: 10,
    factors: [
      { kind: "skill_gap", code: "F1", weight: 3, raw: 2, contribution: 6, values: { closure: 2 } },
      {
        kind: "next_level_requirement",
        code: "F3",
        weight: 1,
        raw: 2,
        contribution: 2,
        values: { target: "Senior", largestGap: 2 },
      },
      {
        kind: "grade",
        code: "F_grade",
        weight: 1,
        raw: 1,
        contribution: 1,
        values: { grade: "Middle", targetGrade: "Senior" },
      },
    ],
    expected: [{ skill_id: "SK_SYSTEM_DESIGN", from: 2, to: 3, max_level: 5 }],
    rules: [],
  };

  /** Never resolves and never rejects - simulates a provider that hangs. */
  function hangingModel(): LanguageModelV4 {
    return {
      specificationVersion: "v4",
      provider: "hanging-test-provider",
      modelId: "hangs-forever",
      supportedUrls: {},
      doGenerate: () => new Promise(() => {}),
      doStream: () => new Promise(() => {}),
    };
  }

  it("the configured production timeout stays within the 10s R-10 budget", () => {
    expect(EXPLAIN_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it("falls back to the deterministic template within a short injected timeout, well inside the 10s budget", async () => {
    const injectedTimeoutMs = 200;
    const start = performance.now();
    const result = await explain(rec, "en", hangingModel(), injectedTimeoutMs);
    const elapsedMs = performance.now() - start;

    console.info(
      `[R-10] explain() fallback on a hanging provider: ${elapsedMs.toFixed(2)}ms ` +
        `(injected timeout ${injectedTimeoutMs}ms, production timeout ${EXPLAIN_TIMEOUT_MS}ms, R-10 budget 10000ms)`,
    );

    expect(result.source).toBe("template");
    expect(result.event_id).toBe(rec.event_id);
    // Fallback returns promptly after the injected timeout, not after hanging.
    expect(elapsedMs).toBeLessThan(injectedTimeoutMs + 1000);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 15_000);
});
