/**
 * Contract-valid sample data (docs/plan.md, T4 row): lets UI be developed
 * and reviewed before T1's engine and T3's API land. Not imported by any
 * page - pages call the real domain functions and render designed loading /
 * empty / error states while those are not ready. Kept here for component
 *-level review and for future tests.
 */
import type { HrAggregates, RecommendationResult, Trajectory } from "@/lib/contracts";

export const sampleTrajectory: Trajectory = {
  current: { role: "Backend Engineer", grade: "Middle" },
  target: { role: "Backend Engineer", grade: "Senior", source: "next_grade" },
  percentMet: 62,
  gaps: [
    {
      skill_id: "SK_SYSTEM_DESIGN",
      name: "System design",
      assessed: 2,
      effective: 3,
      required: 4,
      gap: 1,
      critical: true,
      pendingFrom: [{ event_id: "EV_006", date: "2026-09-08" }],
    },
    {
      skill_id: "SK_CODE_REVIEW",
      name: "Code review",
      assessed: 3,
      effective: 3,
      required: 3,
      gap: 0,
      critical: false,
      pendingFrom: [],
    },
  ],
  currentGradeGaps: [],
};

export const sampleRecommendations: RecommendationResult = {
  employee_id: "E0028",
  scoringVersion: "scoring.v1",
  asOf: "2026-09-23",
  noStep: null,
  blocked: [
    {
      event_id: "EV_020",
      title: "Advanced Distributed Systems",
      failedRule: "prereqs-met",
      detail: "Requires SK_SYSTEM_DESIGN at level 4; you are at 3.",
    },
  ],
  recommendations: [
    {
      event_id: "EV_007",
      title: "System Design Deep Dive",
      type: "workshop",
      format: "online",
      duration_hours: 8,
      next_session: "2026-10-02",
      score: 0.81,
      factors: [
        {
          kind: "skill_gap",
          code: "F1",
          weight: 0.4,
          raw: 1,
          contribution: 0.4,
          values: { skill: "SK_SYSTEM_DESIGN", effective: 3, required: 4 },
        },
        {
          kind: "next_level_requirement",
          code: "F2",
          weight: 0.25,
          raw: 1,
          contribution: 0.25,
          values: { target: "Senior" },
        },
        {
          kind: "grade",
          code: "F3",
          weight: 0.1,
          raw: 1,
          contribution: 0.1,
          values: { grade: "Middle" },
        },
        {
          kind: "participation_history",
          code: "F4",
          weight: 0.06,
          raw: -1,
          contribution: -0.06,
          values: { skill: "SK_SYSTEM_DESIGN", declines: 1 },
        },
      ],
      expected: [{ skill_id: "SK_SYSTEM_DESIGN", from: 3, to: 4, max_level: 5 }],
      rules: [
        { ruleId: "audience-grade", description: "Open to Middle/Senior", status: "pass" },
        { ruleId: "prereqs-met", description: "No prerequisites", status: "pass" },
        { ruleId: "has-session", description: "Has an upcoming session", status: "pass" },
      ],
    },
  ],
};

export const sampleHrAggregates: HrAggregates = {
  n: 42,
  laggingSkills: [
    {
      skill_id: "SK_SYSTEM_DESIGN",
      name: "System design",
      belowOwnGrade: 9,
      belowTarget: 14,
      criticalBelowTarget: { suppressed: true },
    },
  ],
  noStep: [{ employee_id: "E0011", full_name: "Demo Person 11", role: "QA Engineer", grade: "Junior", reason: "NO_SESSION" }],
  participation: [
    {
      event_id: "EV_007",
      title: "System Design Deep Dive",
      mandatory: false,
      byStatus: { completed: 12, in_progress: 3, dropped: { suppressed: true } },
      completionRate: 0.71,
    },
  ],
};
