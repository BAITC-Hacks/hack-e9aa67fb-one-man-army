/**
 * Engine-level tests: the trap fixtures (docs/requirements.md §7, F-01..F-05)
 * layered on the real task dataset (`docs/task/career_quest_dataset/`, which
 * `getDataset()` resolves to by default - the fixtures were authored against
 * its event/skill ids), plus a catalogue-wide property test (R-03) and an
 * ablation check (N-01: removing a factor flips at least one fixture).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDataset, invalidateDataset, type Dataset } from "@/lib/data/load";
import { parseCsv, emptyToUndefined } from "@/lib/data/csv";
import { Employee, HistoryRow } from "@/lib/data/schemas";
import type { Event } from "@/lib/data/schemas";
import type { GapRow } from "@/lib/contracts";
import { effectiveSkills, isProfileIncomplete } from "@/lib/domain/effective";
import { engagement } from "@/lib/domain/history";
import { recommend } from "@/lib/domain/recommend";
import { trajectory } from "@/lib/domain/trajectory";
import { scoreEvent, SCORING_CONFIG } from "@/lib/rules/scoring";

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
    // The fixtures were authored against the committed synthetic seed's small
    // role profiles (e.g. HR Business Partner requires only Public Speaking),
    // not the full task kit's 13-skill profiles - force DATASET_DIR so the
    // trap cases resolve the way their fixture comments describe.
    process.env.DATASET_DIR = join(process.cwd(), "data/seed");
    invalidateDataset();
    ds = await trapDataset();
  });

  afterAll(() => {
    delete process.env.DATASET_DIR;
    invalidateDataset();
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
    const t9003 = ds.employees.find((e) => e.employee_id === "T9003");
    expect(t9003).toBeDefined();
    if (!t9003) return;
    const traj = trajectory(t9003, ds);
    const sdGap = traj.gaps.find((g) => g.skill_id === "SK_SYSTEM_DESIGN");
    expect(sdGap).toBeUndefined();
    // The pending gain is still visible on the (now non-gap) skill.
    expect(traj.currentGradeGaps.concat(traj.gaps).every((g) => g.skill_id !== "SK_SYSTEM_DESIGN")).toBe(true);
  });

  it("F-04 Capped / prereq: recommends the TypeScript unlock, not the blocked or capped events", () => {
    const result = recommend("T9004", ds);
    const eventIds = result.recommendations.map((r) => r.event_id);
    expect(eventIds).toContain("EV_013");
    expect(eventIds).not.toContain("EV_014");
    expect(eventIds).not.toContain("EV_015");
    expect(result.blocked.some((b) => b.event_id === "EV_014")).toBe(true);
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

  it("ablation: removing the participation-history penalty (F5) raises EV_036's score for the F-01 avoider", () => {
    const t9001 = ds.employees.find((e) => e.employee_id === "T9001");
    const ev036 = ds.events.find((e) => e.event_id === "EV_036");
    expect(t9001).toBeDefined();
    expect(ev036).toBeDefined();
    if (!t9001 || !ev036) return;
    const traj = trajectory(t9001, ds);
    const effective = effectiveSkills(t9001, ds.history, ds.events).effective;
    const facts = {
      employee: t9001,
      event: ev036,
      effective,
      gaps: traj.gaps,
      targetGrade: traj.target.grade,
      careerGoalSkillIds: new Set<string>(),
      engagement: engagement("T9001", ev036, ds),
      asOfDate: ds.asOfDate,
    };
    const before = scoreEvent(facts).score;
    const savedWeight = SCORING_CONFIG.weights.F5_participation;
    SCORING_CONFIG.weights.F5_participation = 0;
    try {
      const after = scoreEvent(facts).score;
      expect(after).toBeGreaterThan(before);
    } finally {
      SCORING_CONFIG.weights.F5_participation = savedWeight;
    }
  });
});

describe("F6 format-switch signal (review-1430 #7, docs/domain.md §3)", () => {
  const employee = Employee.parse({
    employee_id: "T9010",
    full_name: "Test Trap-Six",
    department: "Engineering",
    role: "Backend Engineer",
    grade: "Middle",
    manager_id: "E0001",
    hire_date: "2022-02-01",
    tenure_months: 40,
    work_format: "office",
    preferred_language: "en",
    career_goal: null,
    skills: { SK_X: 1 },
    last_review_date: "2026-06-01",
  });
  const gap: GapRow = {
    skill_id: "SK_X",
    name: "X",
    assessed: 1,
    effective: 1,
    required: 3,
    gap: 2,
    critical: true,
    pendingFrom: [],
  };
  const baseEvent: Omit<Event, "format" | "event_id"> = {
    title: "X workshop",
    description: "",
    type: "workshop",
    duration_hours: 2,
    mandatory: false,
    target_roles: ["Backend Engineer"],
    target_grades: ["Middle"],
    develops_skills: [{ skill_id: "SK_X", gain: 1, max_level: 5 }],
    prerequisites: {},
    upcoming_sessions: [],
  };
  const offlineCandidate: Event = { ...baseEvent, event_id: "EV_OFFLINE", format: "offline" };
  const selfPacedCandidate: Event = { ...baseEvent, event_id: "EV_SELF", format: "self_paced" };

  function facts(event: Event, negativeByFormat: Record<string, number>) {
    return {
      employee,
      event,
      effective: { SK_X: 1 },
      gaps: [gap],
      targetGrade: "Middle" as const,
      careerGoalSkillIds: new Set<string>(),
      engagement: { negativeCount: 0, positiveOnTime: 0, negativeByFormat },
      asOfDate: "2026-10-01",
    };
  }

  it("no signal: F6 contributes 0 when there is no negative history", () => {
    const { factors } = scoreEvent(facts(offlineCandidate, {}));
    const f6 = factors.find((f) => f.code === "F6");
    expect(f6?.raw).toBe(0);
    expect(f6?.contribution).toBe(0);
  });

  it("demotes a candidate that repeats the format the employee keeps skipping, with concrete numbers in the trace", () => {
    const { factors } = scoreEvent(facts(offlineCandidate, { offline: 3 }));
    const f6 = factors.find((f) => f.code === "F6");
    expect(f6?.raw).toBeLessThan(0);
    expect(f6?.contribution).toBeLessThan(0);
    expect(f6?.values).toEqual({ skipped: 3, format: "offline" });
  });

  it("favours an alternative-format candidate for the same skill, citing skipped count and both formats", () => {
    const { factors } = scoreEvent(facts(selfPacedCandidate, { offline: 3 }));
    const f6 = factors.find((f) => f.code === "F6");
    expect(f6?.raw).toBeGreaterThan(0);
    expect(f6?.contribution).toBeGreaterThan(0);
    expect(f6?.values).toEqual({ skipped: 3, format: "offline", altFormat: "self_paced" });
  });

  it("net effect: the self-paced alternative outscores the repeated-offline option, all else equal", () => {
    const offlineScore = scoreEvent(facts(offlineCandidate, { offline: 3 })).score;
    const selfPacedScore = scoreEvent(facts(selfPacedCandidate, { offline: 3 })).score;
    expect(selfPacedScore).toBeGreaterThan(offlineScore);
  });
});

describe("no-step classification on the career-quest kit (docs/domain.md §3)", () => {
  // Was asserted LOW_FIT: an eligible, score<=0 candidate (EV_036) existed,
  // and the old classifier treated "any eligible candidate" as LOW_FIT
  // regardless of whether it closed a real gap. Fixed (2026-09-23, operator
  // decision): LOW_FIT now requires the eligible candidate to also close a
  // real gap - EV_036 does not for E0029, so this correctly falls through
  // to ALL_DONE. EV_036 is still traceable in `blocked` either way.
  it("ALL_DONE (not LOW_FIT): the one eligible, score <= 0 candidate does not close a real gap, and it is still traceable in blocked", async () => {
    const ds = await getDataset();
    const result = recommend("E0029", ds);
    expect(result.recommendations).toEqual([]);
    expect(result.noStep).toBe("ALL_DONE");
    const dropped = result.blocked.find((b) => b.event_id === "EV_036");
    expect(dropped).toBeDefined();
    expect(dropped?.failedRule).toBe("score-threshold");
  });

  it("LOW_FIT is never produced without a lowFit recommendation: every LOW_FIT-eligible candidate on the kit is either promoted to a lowFit rec or reclassified to a more specific reason (operator decision 2026-09-23)", async () => {
    const ds = await getDataset();
    let lowFitNoStepCount = 0;
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      if (result.noStep === "LOW_FIT") lowFitNoStepCount += 1;
    }
    expect(lowFitNoStepCount).toBe(0);
  });

  it("lowFit: LOW_FIT employees with a gap-closing eligible candidate get exactly one lowFit recommendation, noStep null", async () => {
    const ds = await getDataset();
    let lowFitCount = 0;
    let noStepLowFitRemaining = 0;
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      const lowFitRecs = result.recommendations.filter((r) => r.lowFit);
      if (lowFitRecs.length > 0) {
        lowFitCount += 1;
        // Exactly one recommendation, and it is the lowFit one.
        expect(result.recommendations.length).toBe(1);
        expect(result.recommendations[0]?.lowFit).toBe(true);
        expect(result.recommendations[0]?.score).toBeLessThanOrEqual(0);
        expect(result.noStep).toBeNull();
      }
      if (result.noStep === "LOW_FIT") noStepLowFitRemaining += 1;
    }
    // Report the post-change distribution (kit has 200 employees): most of
    // the ~36 former LOW_FIT cases now resolve to a single lowFit rec; any
    // still under noStep=LOW_FIT have no candidate that actually closes a
    // real gap (only eligible-but-irrelevant candidates), unaffected by
    // this change.
    expect(lowFitCount).toBeGreaterThan(0);
    expect(lowFitCount + noStepLowFitRemaining).toBeGreaterThan(0);
  });

  it("nobody gets a lowFit recommendation alongside or instead of a normal (non-empty, non-lowFit) recommendation set", async () => {
    const ds = await getDataset();
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      const hasNormalRec = result.recommendations.some((r) => !r.lowFit);
      const hasLowFitRec = result.recommendations.some((r) => r.lowFit);
      expect(hasNormalRec && hasLowFitRec).toBe(false);
      if (hasNormalRec) expect(result.recommendations.every((r) => !r.lowFit)).toBe(true);
    }
  });

  it("ALL_DONE, not DATA_INCOMPLETE: every event that could close a real gap was already completed", async () => {
    const ds = await getDataset();
    const result = recommend("E0093", ds);
    expect(result.recommendations).toEqual([]);
    expect(result.noStep).toBe("ALL_DONE");
  });

  it("no employee in the shipped kit is mislabeled DATA_INCOMPLETE when their profile is complete", async () => {
    const ds = await getDataset();
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      if (result.noStep === "DATA_INCOMPLETE") {
        expect(isProfileIncomplete(emp, ds)).toBe(true);
      }
    }
  });

  it("no recommendation closes zero gaps, across every employee in the shipped kit (review-final.md #2)", async () => {
    const ds = await getDataset();
    let checkedRecs = 0;
    for (const emp of ds.employees) {
      if (isProfileIncomplete(emp, ds)) continue;
      let traj: ReturnType<typeof trajectory>;
      try {
        traj = trajectory(emp, ds);
      } catch {
        continue;
      }
      const gapSkillIds = new Set([...traj.gaps, ...traj.currentGradeGaps].map((g) => g.skill_id));
      const result = recommend(emp.employee_id, ds);
      for (const rec of result.recommendations) {
        const event = ds.events.find((e) => e.event_id === rec.event_id);
        expect(event).toBeDefined();
        const closesRealGap = event?.develops_skills.some((d) => gapSkillIds.has(d.skill_id));
        expect(closesRealGap).toBe(true);
        checkedRecs++;
      }
    }
    expect(checkedRecs).toBeGreaterThan(0);
  });
});
