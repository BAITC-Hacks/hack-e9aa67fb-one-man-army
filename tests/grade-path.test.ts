/**
 * lib/domain/gradePath.ts (O-01) - unit tests on the real dataset, plus a
 * route-level happy path and a cross-employee denial (the final review
 * O-01 / item review, same authz shape as recommendations).
 */
import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/load";
import type { Dataset, Employee, Event, HistoryRow } from "@/lib/data/load";
import { gradePath } from "@/lib/domain/gradePath";
import { encodeSession } from "@/lib/auth/session";
import { GET as gradePathGet } from "@/app/api/employees/[id]/grade-path/route";

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employee_id: "T001",
    full_name: "Test Employee",
    department: "Engineering",
    role: "Backend Engineer",
    grade: "Junior",
    manager_id: null,
    hire_date: "2024-01-01",
    tenure_months: 12,
    work_format: "hybrid",
    preferred_language: "en",
    career_goal: null,
    skills: { SK_CLOUD: 0 },
    last_review_date: "2026-01-01",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    event_id: "EV_T1",
    title: "Test Event",
    description: "",
    type: "course",
    format: "offline",
    duration_hours: 8,
    mandatory: false,
    target_roles: ["Backend Engineer"],
    target_grades: ["Junior"],
    develops_skills: [{ skill_id: "SK_CLOUD", gain: 1, max_level: 3 }],
    prerequisites: {},
    upcoming_sessions: [],
    ...overrides,
  };
}

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    asOfDate: "2026-09-01",
    skills: [{ skill_id: "SK_CLOUD", name: "Cloud", type: "hard", category: "tech", description: "" }],
    roleProfiles: [
      { role: "Backend Engineer", grade: "Junior", required_skills: {}, critical_skills: [] },
      { role: "Backend Engineer", grade: "Middle", required_skills: { SK_CLOUD: 2 }, critical_skills: ["SK_CLOUD"] },
    ],
    employees: [],
    events: [],
    history: [],
    ...overrides,
  };
}

function cookieHeader(value: string): HeadersInit {
  return { cookie: `cq_session=${encodeURIComponent(value)}` };
}

describe("gradePath()", () => {
  it("returns a well-formed, self-consistent plan for a non-Lead employee", async () => {
    const ds = await getDataset();
    const emp = ds.employees.find((e) => e.grade !== "Lead");
    expect(emp).toBeDefined();
    if (!emp) return;

    const result = gradePath(emp, ds);
    expect(result.employee_id).toBe(emp.employee_id);
    expect(result.target.held).toBe(false);
    expect(result.target.grade).not.toBe(emp.grade);

    // Steps are deduplicated.
    const ids = result.steps.map((s) => s.event_id);
    expect(new Set(ids).size).toBe(ids.length);

    // Critical gaps precede non-critical ones in the initial gap table.
    const criticalIdx = result.gaps.findIndex((g) => g.critical);
    const nonCriticalIdx = result.gaps.findIndex((g) => !g.critical);
    if (criticalIdx >= 0 && nonCriticalIdx >= 0) {
      expect(criticalIdx).toBeLessThan(nonCriticalIdx);
    }

    // Every gap the plan claims is unresolved genuinely still falls short of
    // its requirement after every step is applied.
    for (const g of result.unresolvedGaps) {
      expect(result.projectedLevels[g.skill_id]).toBeLessThan(g.required);
    }
    // Every gap not listed as unresolved was actually closed.
    const unresolvedIds = new Set(result.unresolvedGaps.map((g) => g.skill_id));
    for (const g of result.gaps) {
      if (!unresolvedIds.has(g.skill_id)) {
        expect(result.projectedLevels[g.skill_id]).toBeGreaterThanOrEqual(g.required);
      }
    }
  });

  it("prefers a same-skill event in another format over one the employee repeatedly dropped", () => {
    const dropped = makeEvent({ event_id: "EV_DROPPED", format: "offline", develops_skills: [{ skill_id: "SK_CLOUD", gain: 2, max_level: 3 }] });
    const alternative = makeEvent({
      event_id: "EV_ALT",
      title: "Alt",
      format: "online",
      develops_skills: [{ skill_id: "SK_CLOUD", gain: 2, max_level: 3 }],
    });
    const ds = makeDataset({
      employees: [makeEmployee()],
      events: [dropped, alternative],
      history: [
        { record_id: "H1", employee_id: "T001", event_id: "EV_DROPPED", date: "2026-01-01", status: "dropped", completion_pct: 10, assigned_by: "self" },
        { record_id: "H2", employee_id: "T001", event_id: "EV_DROPPED", date: "2026-02-01", status: "dropped", completion_pct: 5, assigned_by: "manager" },
      ] satisfies HistoryRow[],
    });
    const result = gradePath(ds.employees[0]!, ds);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.event_id).toBe("EV_ALT");
    expect(result.steps[0]?.note).toBeUndefined();
  });

  it("keeps a repeatedly-skipped event when it is the only option, and marks it on the step", () => {
    const dropped = makeEvent({ event_id: "EV_DROPPED", develops_skills: [{ skill_id: "SK_CLOUD", gain: 2, max_level: 3 }] });
    const ds = makeDataset({
      employees: [makeEmployee()],
      events: [dropped],
      history: [
        { record_id: "H1", employee_id: "T001", event_id: "EV_DROPPED", date: "2026-01-01", status: "dropped", completion_pct: 10, assigned_by: "self" },
        { record_id: "H2", employee_id: "T001", event_id: "EV_DROPPED", date: "2026-02-01", status: "dropped", completion_pct: 5, assigned_by: "manager" },
      ] satisfies HistoryRow[],
    });
    const result = gradePath(ds.employees[0]!, ds);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.event_id).toBe("EV_DROPPED");
    expect(result.steps[0]?.note).toEqual({ kind: "previously_skipped", count: 2 });
  });

  it("does not mark a step skipped only once (not 'repeatedly')", () => {
    const dropped = makeEvent({ event_id: "EV_DROPPED", develops_skills: [{ skill_id: "SK_CLOUD", gain: 2, max_level: 3 }] });
    const ds = makeDataset({
      employees: [makeEmployee()],
      events: [dropped],
      history: [
        { record_id: "H1", employee_id: "T001", event_id: "EV_DROPPED", date: "2026-01-01", status: "dropped", completion_pct: 10, assigned_by: "self" },
      ] satisfies HistoryRow[],
    });
    const result = gradePath(ds.employees[0]!, ds);
    expect(result.steps[0]?.note).toBeUndefined();
  });

  it("reports the post-plan projected level on unresolved gaps, not the pre-plan one", () => {
    // Middle requires SK_CLOUD 2, critical, max_level of the only event caps at 1: partly closes, stays open.
    const cappedEvent = makeEvent({ event_id: "EV_CAP", develops_skills: [{ skill_id: "SK_CLOUD", gain: 1, max_level: 1 }] });
    const ds = makeDataset({
      employees: [makeEmployee()],
      events: [cappedEvent],
    });
    const result = gradePath(ds.employees[0]!, ds);
    const gap = result.unresolvedGaps.find((g) => g.skill_id === "SK_CLOUD");
    expect(gap).toBeDefined();
    expect(gap?.effective).toBe(0); // pre-plan baseline, unchanged
    expect(gap?.projected).toBe(1); // post-plan: the capped event raised it to 1
    expect(result.projectedLevels.SK_CLOUD).toBe(1);
  });

  it("holds at the current grade's own requirements when there is no next grade (Lead)", async () => {
    const ds = await getDataset();
    const lead = ds.employees.find((e) => e.grade === "Lead" && ds.roleProfiles.some((p) => p.role === e.role && p.grade === "Lead"));
    expect(lead).toBeDefined();
    if (!lead) return;
    const result = gradePath(lead, ds);
    expect(result.target.grade).toBe("Lead");
    expect(result.target.held).toBe(true);
  });
});

describe("E0028 trap (avoidance-aware, the final review item 3)", () => {
  it("if EV_009 (dropped twice) is still proposed, it must carry the previously_skipped note", async () => {
    const ds = await getDataset();
    const emp = ds.employees.find((e) => e.employee_id === "E0028");
    if (!emp) return; // fixture not present in this run's dataset
    const result = gradePath(emp, ds);
    const ev009Step = result.steps.find((s) => s.event_id === "EV_009");
    if (ev009Step) {
      expect(ev009Step.note?.kind).toBe("previously_skipped");
      expect(ev009Step.note?.count).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("GET /api/employees/[id]/grade-path", () => {
  it("self access returns 200 with the plan shape", async () => {
    const ds = await getDataset();
    const emp = ds.employees[0];
    expect(emp).toBeDefined();
    if (!emp) return;
    const cookie = encodeSession({ role: "employee", employeeId: emp.employee_id });
    const request = new Request(`http://localhost/api/employees/${emp.employee_id}/grade-path`, {
      headers: cookieHeader(cookie),
    });
    const response = await gradePathGet(request, { params: Promise.resolve({ id: emp.employee_id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.employee_id).toBe(emp.employee_id);
    expect(Array.isArray(body.gaps)).toBe(true);
    expect(Array.isArray(body.steps)).toBe(true);
    expect(Array.isArray(body.unresolvedGaps)).toBe(true);
    expect(typeof body.projectedLevels).toBe("object");
  });

  it("cross-employee access is denied 403", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E9999/grade-path", {
      headers: cookieHeader(cookie),
    });
    const response = await gradePathGet(request, { params: Promise.resolve({ id: "E9999" }) });
    expect(response.status).toBe(403);
  });
});
