/**
 * completedActivities(): only this employee, only status "completed",
 * newest first, skill names resolved.
 */
import { describe, expect, it } from "vitest";
import type { Dataset, Employee } from "@/lib/data/load";
import { completedActivities } from "@/lib/domain/completed";

function baseDs(overrides: Partial<Dataset> = {}): Dataset {
  return {
    asOfDate: "2026-10-01",
    skills: [
      { skill_id: "SK_X", name: "X Skill", type: "hard", category: "c", description: "d" },
      { skill_id: "SK_Y", name: "Y Skill", type: "soft", category: "c", description: "d" },
    ],
    roleProfiles: [],
    employees: [],
    events: [
      {
        event_id: "EV_1",
        title: "Course One",
        description: "d",
        type: "course",
        format: "online",
        duration_hours: 1,
        mandatory: false,
        target_roles: [],
        target_grades: [],
        develops_skills: [{ skill_id: "SK_X", gain: 1, max_level: 5 }],
        prerequisites: {},
        upcoming_sessions: [],
      },
      {
        event_id: "EV_2",
        title: "Course Two",
        description: "d",
        type: "workshop",
        format: "offline",
        duration_hours: 2,
        mandatory: false,
        target_roles: [],
        target_grades: [],
        develops_skills: [{ skill_id: "SK_Y", gain: 2, max_level: 5 }],
        prerequisites: {},
        upcoming_sessions: [],
      },
    ],
    history: [],
    dismissals: {},
    ...overrides,
  };
}

function emp(overrides: Partial<Employee> = {}): Employee {
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
    skills: {},
    last_review_date: "2026-06-24",
    ...overrides,
  };
}

describe("completedActivities()", () => {
  it("returns only this employee's completed rows, newest first, with skill names resolved", () => {
    const ds = baseDs({
      history: [
        {
          record_id: "H1",
          employee_id: "E1",
          event_id: "EV_1",
          date: "2026-01-01",
          status: "completed",
          completion_pct: 100,
          assigned_by: "self",
        },
        {
          record_id: "H2",
          employee_id: "E1",
          event_id: "EV_2",
          date: "2026-03-01",
          status: "completed",
          completion_pct: 100,
          assigned_by: "self",
        },
        // other employee - excluded
        {
          record_id: "H3",
          employee_id: "E2",
          event_id: "EV_1",
          date: "2026-05-01",
          status: "completed",
          completion_pct: 100,
          assigned_by: "self",
        },
        // in progress - excluded
        {
          record_id: "H4",
          employee_id: "E1",
          event_id: "EV_1",
          date: "2026-06-01",
          status: "in_progress",
          completion_pct: 40,
          assigned_by: "self",
        },
      ],
    });

    const result = completedActivities(emp(), ds);

    expect(result.map((r) => r.record_id)).toEqual(["H2", "H1"]);
    expect(result[0]).toMatchObject({
      record_id: "H2",
      title: "Course Two",
      type: "workshop",
      format: "offline",
      date: "2026-03-01",
    });
    expect(result[0]?.skills).toEqual([{ skill_id: "SK_Y", name: "Y Skill", gain: 2 }]);
    expect(result[1]?.skills).toEqual([{ skill_id: "SK_X", name: "X Skill", gain: 1 }]);
  });

  it("returns an empty array when there are no completed rows", () => {
    const ds = baseDs({
      history: [
        {
          record_id: "H1",
          employee_id: "E1",
          event_id: "EV_1",
          date: "2026-01-01",
          status: "dropped",
          completion_pct: 10,
          assigned_by: "self",
        },
      ],
    });
    expect(completedActivities(emp(), ds)).toEqual([]);
  });
});
