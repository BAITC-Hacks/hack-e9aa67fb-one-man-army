/**
 * Multi-factor scoring (docs/domain.md §3, docs/requirements.md N-01, R-04,
 * R-08). `score(e) = Sum weight x raw`. Every candidate always carries all six
 * configured factor kinds (even when raw is 0), so "≥3 distinct factor kinds"
 * holds structurally, not just on the lucky fixture. Weights are versioned so
 * every trace is reproducible (`scoring.v1`).
 *
 * N-01 requires that ranking rest on >=3 independent signals and that removing
 * any one changes at least one trap fixture's outcome (see tests/engine.test.ts
 * "ablation" case). The six factors below are independent: skill criticality,
 * gap severity, forward-looking audience fit, stated career goal, participation
 * history and session timeliness.
 */
import type { Factor, GapRow } from "../contracts";
import type { Grade, Employee, Event } from "../data/load";
import type { Engagement } from "../domain/history";

export const SCORING_CONFIG = {
  version: "scoring.v1" as const,
  weights: {
    F1_critical_gap: 3,
    F2_noncritical_gap: 1,
    F3_gap_severity: 1,
    F4_career_goal: 1,
    F5_participation: -1.5,
    F_grade_fit: 1,
    F9_session: 0.5,
  },
};

export interface ScoreFacts {
  employee: Employee;
  event: Event;
  effective: Record<string, number>;
  gaps: GapRow[];
  targetGrade: Grade;
  careerGoalSkillIds: Set<string>;
  engagement: Engagement;
  asOfDate: string;
}

function usefulGain(effectiveLevel: number, gain: number, maxLevel: number): number {
  return Math.max(0, Math.min(effectiveLevel + gain, maxLevel) - effectiveLevel);
}

function daysBetween(asOf: string, date: string): number {
  const a = new Date(asOf).getTime();
  const d = new Date(date).getTime();
  if (Number.isNaN(a) || Number.isNaN(d)) return Number.POSITIVE_INFINITY;
  return (d - a) / (1000 * 60 * 60 * 24);
}

export function scoreEvent(facts: ScoreFacts): { score: number; factors: Factor[] } {
  const gapBySkill = new Map(facts.gaps.map((g) => [g.skill_id, g]));
  const w = SCORING_CONFIG.weights;

  let criticalClosure = 0;
  let nonCriticalClosure = 0;
  let maxGapClosed = 0;
  let careerGoalRaw = 0;

  for (const dev of facts.event.develops_skills) {
    const eff = facts.effective[dev.skill_id] ?? 0;
    const gain = usefulGain(eff, dev.gain, dev.max_level);
    if (gain <= 0) continue;
    const gapRow = gapBySkill.get(dev.skill_id);
    if (gapRow) {
      const closes = Math.min(gain, gapRow.gap);
      if (gapRow.critical) criticalClosure += closes;
      else nonCriticalClosure += closes;
      maxGapClosed = Math.max(maxGapClosed, gapRow.gap);
    }
    if (facts.careerGoalSkillIds.has(dev.skill_id)) careerGoalRaw = 1;
  }

  const gradeFitRaw = facts.event.target_grades.includes(facts.targetGrade) ? 1 : 0.5;
  const negativeCapped = Math.min(facts.engagement.negativeCount, 3);
  const hasSoonSession =
    facts.event.format === "self_paced" ||
    facts.event.upcoming_sessions.some((d) => {
      const delta = daysBetween(facts.asOfDate, d);
      return delta >= 0 && delta <= 30;
    });

  const factors: Factor[] = [
    {
      kind: "skill_gap",
      code: "F1",
      weight: w.F1_critical_gap,
      raw: criticalClosure,
      contribution: w.F1_critical_gap * criticalClosure,
      values: { closure: criticalClosure },
    },
    {
      kind: "skill_gap",
      code: "F2",
      weight: w.F2_noncritical_gap,
      raw: nonCriticalClosure,
      contribution: w.F2_noncritical_gap * nonCriticalClosure,
      values: { closure: nonCriticalClosure },
    },
    {
      kind: "next_level_requirement",
      code: "F3",
      weight: w.F3_gap_severity,
      raw: maxGapClosed,
      contribution: w.F3_gap_severity * maxGapClosed,
      values: { target: facts.targetGrade, largestGap: maxGapClosed },
    },
    {
      kind: "career_goal",
      code: "F4",
      weight: w.F4_career_goal,
      raw: careerGoalRaw,
      contribution: w.F4_career_goal * careerGoalRaw,
      values: { hasGoal: facts.employee.career_goal ? 1 : 0 },
    },
    {
      kind: "participation_history",
      code: "F5",
      weight: w.F5_participation,
      raw: negativeCapped,
      contribution: w.F5_participation * negativeCapped,
      values: { negativeRecords: facts.engagement.negativeCount, positiveOnTime: facts.engagement.positiveOnTime },
    },
    {
      kind: "grade",
      code: "F_grade",
      weight: w.F_grade_fit,
      raw: gradeFitRaw,
      contribution: w.F_grade_fit * gradeFitRaw,
      values: { grade: facts.employee.grade, targetGrade: facts.targetGrade },
    },
    {
      kind: "session_availability",
      code: "F9",
      weight: w.F9_session,
      raw: hasSoonSession ? 1 : 0,
      contribution: w.F9_session * (hasSoonSession ? 1 : 0),
      values: { format: facts.event.format },
    },
  ];

  const score = factors.reduce((sum, f) => sum + f.contribution, 0);
  return { score, factors };
}
