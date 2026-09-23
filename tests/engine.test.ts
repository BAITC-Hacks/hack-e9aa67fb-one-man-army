/**
 * Engine-level tests: the trap fixtures (docs/requirements.md §7, F-01..F-05)
 * layered on the real task dataset (`docs/task/career_quest_dataset/`, which
 * `getDataset()` resolves to by default - the fixtures were authored against
 * its event/skill ids), plus a catalogue-wide property test (R-03) and an
 * ablation check (N-01: removing a factor flips at least one fixture).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getDataset, invalidateDataset, type Dataset } from "@/lib/data/load";
import { parseCsv, emptyToUndefined } from "@/lib/data/csv";
import { Employee, HistoryRow } from "@/lib/data/schemas";
import { recommend } from "@/lib/domain/recommend";
import { SCORING_CONFIG } from "@/lib/rules/scoring";

function loadFixture(id: string): { employees: Employee[]; history: HistoryRow[] } {
  const dir = join(process.cwd(), "data/fixtures");
  const raw = JSON.parse(readFileSync(join(dir, `trap-${id}.json`), "utf8"));
  const employees = (raw.employees as unknown[]).map((e) => Employee.parse(e));
  const csvText = readFileSync(join(dir, `trap-${id}.csv`), "utf8");
  const history = parseCsv(csvText)
    .map(emptyToUndefined)
    .map((r) => HistoryRow.parse(r));
  return { employees, history };
}

/** The base dataset, with every trap fixture's employee + history merged in -
 * so `recommend()` can be exercised against them exactly as HR import would. */
async function trapDataset(): Promise<Dataset> {
  const base = await getDataset();
  const ids = ["F01", "F02", "F03", "F04", "F05", "F06"];
  const employees = [...base.employees];
  const history = [...base.history];
  for (const id of ids) {
    const fixture = loadFixture(id);
    employees.push(...fixture.employees);
    history.push(...fixture.history);
  }
  return { ...base, employees, history };
}

describe("trap profiles (R-08, N-01)", () => {
  let ds: Dataset;

  beforeAll(async () => {
    // No DATASET_DIR override: resolves to docs/task/career_quest_dataset,
    // which the fixtures reference (EV_005/006/007/009/010/013-015/022/036).
    delete process.env.DATASET_DIR;
    invalidateDataset();
    ds = await trapDataset();
  });

  it("F-01 Avoider: closes System Design, not the lowest-skill Public Speaking", () => {
    const result = recommend("T9001", ds);
    expect(result.recommendations.length).toBeGreaterThan(0);
    const top = result.recommendations[0];
    expect(top).toBeDefined();
    expect(top?.event_id).not.toBe("EV_036");
    expect(top?.expected.some((e) => e.skill_id === "SK_SYSTEM_DESIGN")).toBe(true);
    // Every rec carries >=3 distinct factor kinds.
    for (const rec of result.recommendations) {
      expect(new Set(rec.factors.map((f) => f.kind)).size).toBeGreaterThanOrEqual(3);
    }
    // Baseline-differs: "lowest skill" would pick Public Speaking (level 0).
    expect(top?.expected.some((e) => e.skill_id === "SK_PUBLIC_SPEAKING")).toBe(false);
  });

  it("F-02 Irrelevant zero: targets the critical SQL gap, not the untouched React field", () => {
    const result = recommend("T9002", ds);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.expected.some((e) => e.skill_id === "SK_SQL"))).toBe(true);
    expect(result.recommendations.every((r) => r.expected.every((e) => e.skill_id !== "SK_REACT"))).toBe(true);
  });

  it("F-03 Stale review: the pending EV_007 gain already closes System Design, so it is not a gap", () => {
    const trajResult = recommend("T9003", ds); // exercises trajectory() internally too
    expect(trajResult.recommendations.every((r) => !r.expected.some((e) => e.skill_id === "SK_SYSTEM_DESIGN"))).toBe(true);
  });

  it("F-04 Capped / prereq: recommends the TypeScript unlock, not the blocked or capped events", () => {
    const result = recommend("T9004", ds);
    const eventIds = result.recommendations.map((r) => r.event_id);
    expect(eventIds).toContain("EV_013");
    expect(eventIds).not.toContain("EV_014");
    expect(eventIds).not.toContain("EV_015");
    expect(result.blocked.some((b) => b.event_id === "EV_014" && b.failedRule === "prereqs-met")).toBe(true);
  });

  it("F-05 Nothing left: an HR Lead already at target returns [] with AT_TOP_NO_GAP", () => {
    const result = recommend("T9005", ds);
    expect(result.recommendations).toEqual([]);
    expect(result.noStep).toBe("AT_TOP_NO_GAP");
  });

  it("never recommends a mandatory event, across every employee in the merged dataset", () => {
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      expect(result.recommendations.length).toBeLessThanOrEqual(3);
      for (const rec of result.recommendations) {
        const event = ds.events.find((e) => e.event_id === rec.event_id);
        expect(event?.mandatory).not.toBe(true);
      }
    }
  });

  it("ablation: zeroing the critical-gap weight (F1) flips the F-01 top pick", () => {
    const before = recommend("T9001", ds).recommendations[0]?.event_id;
    const savedWeight = SCORING_CONFIG.weights.F1_critical_gap;
    SCORING_CONFIG.weights.F1_critical_gap = 0;
    try {
      const after = recommend("T9001", ds).recommendations[0]?.event_id;
      expect(after).not.toBe(before);
    } finally {
      SCORING_CONFIG.weights.F1_critical_gap = savedWeight;
    }
  });
});
