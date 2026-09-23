import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset, Employee } from "@/lib/data/load";
import type { RecommendationResult } from "@/lib/contracts";

const recommendMock = vi.fn<(empId: string, ds: Dataset) => RecommendationResult>();
vi.mock("@/lib/domain/recommend", () => ({ recommend: (empId: string, ds: Dataset) => recommendMock(empId, ds) }));

const { hrAggregates } = await import("@/lib/domain/hr");

function employee(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    employee_id: id,
    full_name: `Demo Person ${id}`,
    department: "Engineering",
    role: "Backend",
    grade: "Middle",
    manager_id: null,
    hire_date: "2023-01-01",
    tenure_months: 30,
    work_format: "hybrid",
    preferred_language: "en",
    career_goal: null,
    skills: { SK_SYSTEM_DESIGN: 1 },
    last_review_date: "2026-06-24",
    ...overrides,
  };
}

const roleProfiles = [
  {
    role: "Backend",
    grade: "Middle" as const,
    required_skills: { SK_SYSTEM_DESIGN: 2 },
    critical_skills: ["SK_SYSTEM_DESIGN"],
  },
  {
    role: "Backend",
    grade: "Senior" as const,
    required_skills: { SK_SYSTEM_DESIGN: 4 },
    critical_skills: ["SK_SYSTEM_DESIGN"],
  },
];

const skills = [
  { skill_id: "SK_SYSTEM_DESIGN", name: "System Design", type: "hard" as const, category: "eng", description: "d" },
];

beforeEach(() => {
  recommendMock.mockReset();
  recommendMock.mockReturnValue({
    employee_id: "x",
    scoringVersion: "scoring.v1",
    asOf: "2026-09-01",
    recommendations: [],
    noStep: null,
    blocked: [],
  });
});

describe("hrAggregates - laggingSkills suppression", () => {
  it("suppresses a group count under 5 and shows counts of 5 or more", () => {
    const under5 = Array.from({ length: 3 }, (_, i) => employee(`U${i}`, { skills: { SK_SYSTEM_DESIGN: 0 } }));
    const atLeast5 = Array.from({ length: 5 }, (_, i) => employee(`A${i}`, { skills: { SK_SYSTEM_DESIGN: 0 } }));
    const ds: Dataset = {
      asOfDate: "2026-09-01",
      skills,
      roleProfiles,
      employees: [...under5],
      events: [],
      history: [],
    };
    const suppressed = hrAggregates(ds).laggingSkills[0];
    expect(suppressed?.belowOwnGrade).toEqual({ suppressed: true });

    ds.employees = atLeast5;
    const shown = hrAggregates(ds).laggingSkills[0];
    expect(shown?.belowOwnGrade).toBe(5);
  });
});

describe("hrAggregates - noStep", () => {
  it("lists employees with a NoStepReason, sorted by employee_id (never by score)", () => {
    const ds: Dataset = {
      asOfDate: "2026-09-01",
      skills,
      roleProfiles,
      employees: [employee("E0003"), employee("E0001"), employee("E0002")],
      events: [],
      history: [],
    };
    recommendMock.mockImplementation((empId: string) => ({
      employee_id: empId,
      scoringVersion: "scoring.v1",
      asOf: "2026-09-01",
      recommendations: [],
      noStep: empId === "E0002" ? null : "ALL_DONE",
      blocked: [],
    }));

    const result = hrAggregates(ds);
    expect(result.noStep.map((row) => row.employee_id)).toEqual(["E0001", "E0003"]);
    expect(result.noStep.every((row) => row.reason === "ALL_DONE")).toBe(true);
  });
});

describe("hrAggregates - participation", () => {
  it("suppresses status counts under 5 and computes completionRate from raw counts", () => {
    const history = [
      ...Array.from({ length: 2 }, (_, i) => ({
        record_id: `c${i}`,
        employee_id: `E${i}`,
        event_id: "EV_100",
        date: "2026-08-01",
        status: "completed" as const,
        completion_pct: 100,
        assigned_by: "self" as const,
      })),
      {
        record_id: "d0",
        employee_id: "E9",
        event_id: "EV_100",
        date: "2026-08-01",
        status: "declined" as const,
        completion_pct: 0,
        assigned_by: "self" as const,
      },
    ];
    const ds: Dataset = {
      asOfDate: "2026-09-01",
      skills: [],
      roleProfiles: [],
      employees: [],
      events: [
        {
          event_id: "EV_100",
          title: "Course",
          description: "d",
          type: "course",
          format: "online",
          duration_hours: 4,
          mandatory: false,
          target_roles: [],
          target_grades: [],
          develops_skills: [],
          prerequisites: {},
          upcoming_sessions: [],
        },
      ],
      history,
    };

    const row = hrAggregates(ds).participation[0];
    expect(row?.byStatus.completed).toEqual({ suppressed: true });
    expect(row?.completionRate).toBeCloseTo(2 / 3);
  });
});
