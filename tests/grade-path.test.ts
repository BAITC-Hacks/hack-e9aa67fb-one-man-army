/**
 * lib/domain/gradePath.ts (O-01) - unit tests on the real dataset, plus a
 * route-level happy path and a cross-employee denial (docs/review-1430.md
 * O-01 / item review, same authz shape as recommendations).
 */
import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/load";
import { gradePath } from "@/lib/domain/gradePath";
import { encodeSession } from "@/lib/auth/session";
import { GET as gradePathGet } from "@/app/api/employees/[id]/grade-path/route";

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
