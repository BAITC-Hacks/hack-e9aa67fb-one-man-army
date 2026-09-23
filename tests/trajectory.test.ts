/**
 * trajectory() unit tests: effective-skill projection (I-06), target
 * selection (goal / next grade / hold), and the golden-path E0028 numbers.
 */
import { describe, expect, it } from "vitest";
import { getDataset, invalidateDataset, type Dataset, type Employee } from "@/lib/data/load";
import { trajectory } from "@/lib/domain/trajectory";

const roleProfiles = [
  { role: "Backend Engineer", grade: "Middle" as const, required_skills: { SK_X: 2 }, critical_skills: ["SK_X"] },
  { role: "Backend Engineer", grade: "Senior" as const, required_skills: { SK_X: 4 }, critical_skills: ["SK_X"] },
  { role: "Backend Engineer", grade: "Lead" as const, required_skills: { SK_X: 4 }, critical_skills: [] },
  { role: "Backend Engineer", grade: "Junior" as const, required_skills: { SK_X: 4 }, critical_skills: [] },
];

function baseDs(overrides: Partial<Dataset> = {}): Dataset {
  return {
    asOfDate: "2026-10-01",
    skills: [{ skill_id: "SK_X", name: "X", type: "hard", category: "c", description: "d" }],
    roleProfiles,
    employees: [],
    events: [],
    history: [],
    dismissals: {},
    ...overrides,
  };
}

function emp(overrides: Partial<Employee>): Employee {
  return {
    employee_id: "E1",
    full_name: "Test",
    department: "d",
    role: "Backend Engineer",
    grade: "Middle",
    manager_id: null,
    hire_date: "2020-01-01",
    tenure_months: 10,
    work_format: "office",
    preferred_language: "en",
    career_goal: null,
    skills: { SK_X: 2 },
    last_review_date: "2026-06-24",
    ...overrides,
  };
}

describe("trajectory()", () => {
  it("defaults to the next grade when no career goal is set", () => {
    const t = trajectory(emp({}), baseDs());
    expect(t.target).toEqual({ role: "Backend Engineer", grade: "Senior", source: "next_grade" });
    expect(t.gaps[0]).toMatchObject({ skill_id: "SK_X", gap: 2, critical: true });
  });

  it("uses the stated career goal as target when set", () => {
    const t = trajectory(emp({ career_goal: { target_role: "Backend Engineer", target_grade: "Lead" } }), baseDs());
    expect(t.target).toEqual({ role: "Backend Engineer", grade: "Lead", source: "goal" });
  });

  it("holds at Lead with no further grade when requirements are met", () => {
    const t = trajectory(emp({ grade: "Lead", skills: { SK_X: 4 } }), baseDs());
    expect(t.target.source).toBe("hold");
    expect(t.gaps).toEqual([]);
  });

  it("applies a completed event's gain, dated after last_review_date, to the effective level", () => {
    const ds = baseDs({
      events: [
        {
          event_id: "EV_1",
          title: "T",
          description: "d",
          type: "course",
          format: "online",
          duration_hours: 1,
          mandatory: false,
          target_roles: ["Backend Engineer"],
          target_grades: ["Middle"],
          develops_skills: [{ skill_id: "SK_X", gain: 1, max_level: 5 }],
          prerequisites: {},
          upcoming_sessions: [],
        },
      ],
      history: [
        {
          record_id: "H1",
          employee_id: "E1",
          event_id: "EV_1",
          date: "2026-09-08",
          status: "completed",
          completion_pct: 100,
          assigned_by: "self",
        },
      ],
    });
    const t = trajectory(emp({}), ds);
    const gap = t.gaps.find((g) => g.skill_id === "SK_X");
    expect(gap?.assessed).toBe(2);
    expect(gap?.effective).toBe(3);
    expect(gap?.pendingFrom).toEqual([{ event_id: "EV_1", date: "2026-09-08" }]);
  });
});

describe("trajectory() on the golden-path employee (E0028)", () => {
  it("SD assessed 2 -> effective 3, a critical gap vs Senior 4", async () => {
    process.env.DATASET_DIR = "data/seed"; // judges run on the committed seed, not the local kit
    invalidateDataset();
    const ds = await getDataset();
    const e0028 = ds.employees.find((e) => e.employee_id === "E0028");
    expect(e0028).toBeDefined();
    if (!e0028) return;
    const t = trajectory(e0028, ds);
    const sdGap = t.gaps.find((g) => g.skill_id === "SK_SYSTEM_DESIGN");
    expect(sdGap).toBeDefined();
    expect(sdGap?.assessed).toBe(2);
    expect(sdGap?.effective).toBe(3);
    expect(sdGap?.required).toBe(4);
    expect(sdGap?.critical).toBe(true);
  });
});
