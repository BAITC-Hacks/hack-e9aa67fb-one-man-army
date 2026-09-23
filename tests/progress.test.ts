import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset, Employee, Event } from "@/lib/data/load";
import type { RecommendationResult, Trajectory } from "@/lib/contracts";

const emptyTrajectory: Trajectory = {
  current: { role: "Backend", grade: "Middle" },
  target: { role: "Backend", grade: "Senior", source: "next_grade" },
  gaps: [],
  percentMet: 0,
  currentGradeGaps: [],
};

const emptyRecs: RecommendationResult = {
  employee_id: "E0028",
  scoringVersion: "scoring.v1",
  asOf: "2026-09-01",
  recommendations: [],
  noStep: null,
  blocked: [],
};

const trajectoryMock = vi.fn(() => emptyTrajectory);
const recommendMock = vi.fn(() => emptyRecs);
const appendJsonlMock = vi.fn(async () => undefined);
const recordAuditMock = vi.fn(async () => ({}));
let dataset: Dataset;
const getDatasetMock = vi.fn(async () => dataset);
const invalidateDatasetMock = vi.fn(() => undefined);

vi.mock("@/lib/domain/trajectory", () => ({ trajectory: trajectoryMock }));
vi.mock("@/lib/domain/recommend", () => ({ recommend: recommendMock }));
vi.mock("@/lib/store/jsonl", () => ({ appendJsonl: appendJsonlMock }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: recordAuditMock }));
vi.mock("@/lib/data/load", () => ({
  getDataset: getDatasetMock,
  invalidateDataset: invalidateDatasetMock,
}));

const { applyGrowth, completeEvent, ProgressError } = await import("@/lib/domain/progress");

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    employee_id: "E0028",
    full_name: "Demo Person 28",
    department: "Engineering",
    role: "Backend",
    grade: "Middle",
    manager_id: null,
    hire_date: "2023-01-01",
    tenure_months: 30,
    work_format: "hybrid",
    preferred_language: "en",
    career_goal: null,
    skills: { SK_SYSTEM_DESIGN: 3 },
    last_review_date: "2026-06-24",
    ...overrides,
  };
}

function event(overrides: Partial<Event> = {}): Event {
  return {
    event_id: "EV_100",
    title: "System Design Deep Dive",
    description: "d",
    type: "course",
    format: "online",
    duration_hours: 8,
    mandatory: false,
    target_roles: ["Backend"],
    target_grades: ["Middle"],
    develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 }],
    prerequisites: {},
    upcoming_sessions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dataset = {
    asOfDate: "2026-09-01",
    skills: [],
    roleProfiles: [],
    employees: [employee()],
    events: [event()],
    history: [],
  };
});

describe("applyGrowth", () => {
  it("caps at max_level", () => {
    expect(applyGrowth(4, 3, 5)).toBe(5);
  });
  it("never drops below the current level", () => {
    expect(applyGrowth(3, 0, 5)).toBe(3);
  });
});

describe("completeEvent", () => {
  it("moves SD 3 -> 4, appends completions.jsonl, and audits", async () => {
    const result = await completeEvent("E0028", "EV_100", { role: "employee", id: "E0028" });

    expect(result.changes).toEqual([
      { skill_id: "SK_SYSTEM_DESIGN", before: 3, after: 4, gain: 1, max_level: 5, capped: false },
    ]);
    expect(appendJsonlMock).toHaveBeenCalledWith(
      "completions.jsonl",
      expect.objectContaining({ employee_id: "E0028", event_id: "EV_100", status: "completed" }),
    );
    expect(invalidateDatasetMock).toHaveBeenCalledOnce();
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "progress.event-completed", outcome: "completed" }),
    );
    expect(trajectoryMock).toHaveBeenCalledTimes(2);
    expect(recommendMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a re-completion of an already-completed event", async () => {
    dataset.history = [
      {
        record_id: "r1",
        employee_id: "E0028",
        event_id: "EV_100",
        date: "2026-08-01",
        status: "completed",
        completion_pct: 100,
        assigned_by: "self",
      },
    ];
    await expect(
      completeEvent("E0028", "EV_100", { role: "employee", id: "E0028" }),
    ).rejects.toThrow(ProgressError);
    expect(appendJsonlMock).not.toHaveBeenCalled();
  });
});
