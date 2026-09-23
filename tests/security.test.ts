/**
 * Security acceptance tests (docs/threat-model.md), complementing
 * tests/authz.test.ts. Covers: forged/tampered/unsigned cookies (T1), IDOR
 * on the state-changing /complete and /dismiss routes (T2), no leaderboard
 * or ranking exposure (T14/N-02), and HR k<5 suppression against the real
 * dataset through the actual route handler (T4). Upload-endpoint tests
 * (T7-T10) are owned by tests/import.test.ts and skipped here.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { encodeSession, decodeSession } from "@/lib/auth/session";

function cookieHeader(value: string): HeadersInit {
  return { cookie: `cq_session=${encodeURIComponent(value)}` };
}

describe("security: forged / tampered / unsigned cookies (T1)", () => {
  it("decodeSession rejects a tampered signature", () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const payload = cookie.split(".")[0];
    expect(decodeSession(`${payload}.not-the-real-signature`)).toBeNull();
  });

  it("decodeSession rejects a cookie with no signature separator (unsigned)", () => {
    expect(decodeSession("garbage-no-dot-at-all")).toBeNull();
  });

  it("decodeSession rejects a payload edited after signing (role-escalation attempt)", () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const signature = cookie.split(".")[1];
    const forgedPayload = Buffer.from(JSON.stringify({ role: "hr", id: "HR01" }), "utf8").toString("base64url");
    expect(decodeSession(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("a request with a tampered cookie is refused (401), never granted", async () => {
    const { GET: employeeGet } = await import("@/app/api/employees/[id]/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const tampered = `${cookie.split(".")[0]}.tampered-signature`;
    const request = new Request("http://localhost/api/employees/E0001", { headers: cookieHeader(tampered) });
    const response = await employeeGet(request, { params: Promise.resolve({ id: "E0001" }) });
    expect(response.status).toBe(401);
  });
});

describe("security: IDOR on state-changing routes (T2)", () => {
  it("an employee session cannot POST /complete on behalf of another employee id -> 403", async () => {
    const { POST: completePost } = await import("@/app/api/employees/[id]/complete/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E0002/complete", {
      method: "POST",
      headers: { ...cookieHeader(cookie), "content-type": "application/json" },
      body: JSON.stringify({ event_id: "EV_005" }),
    });
    const response = await completePost(request, { params: Promise.resolve({ id: "E0002" }) });
    expect(response.status).toBe(403);
  });

  it("an employee session cannot POST /dismiss on behalf of another employee id -> 403", async () => {
    const { POST: dismissPost } = await import("@/app/api/employees/[id]/dismiss/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E0002/dismiss", {
      method: "POST",
      headers: { ...cookieHeader(cookie), "content-type": "application/json" },
      body: JSON.stringify({ event_id: "EV_005" }),
    });
    const response = await dismissPost(request, { params: Promise.resolve({ id: "E0002" }) });
    expect(response.status).toBe(403);
  });

  it("a role forged in the /complete request body is ignored - only the signed cookie decides", async () => {
    const { POST: completePost } = await import("@/app/api/employees/[id]/complete/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E0002/complete", {
      method: "POST",
      headers: { ...cookieHeader(cookie), "content-type": "application/json" },
      // Deliberately spoofing a "role" field the schema does not define / the route never reads.
      body: JSON.stringify({ event_id: "EV_005", role: "hr" }),
    });
    const response = await completePost(request, { params: Promise.resolve({ id: "E0002" }) });
    expect(response.status).toBe(403);
  });
});

describe("security: voluntariness - HR cannot act on an employee's behalf", () => {
  const routes = {
    complete: () => import("@/app/api/employees/[id]/complete/route"),
    dismiss: () => import("@/app/api/employees/[id]/dismiss/route"),
  };
  for (const [route, load] of Object.entries(routes)) {
    it(`an HR session POSTing /${route} for an employee -> 403 FORBIDDEN (fail closed)`, async () => {
      const { POST } = await load();
      const cookie = encodeSession({ role: "hr", id: "HR01" });
      const request = new Request(`http://localhost/api/employees/E0028/${route}`, {
        method: "POST",
        headers: { ...cookieHeader(cookie), "content-type": "application/json" },
        body: JSON.stringify({ event_id: "EV_005" }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "E0028" }) });
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    });
  }
});

describe("security: no leaderboard / ranking exposure (N-02, T14)", () => {
  it("no route path segment named leaderboard or rank exists under app/api", () => {
    const apiDir = join(process.cwd(), "app/api");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const full = join(dir, entry.name);
        if (/leaderboard|\brank\b/i.test(entry.name)) offenders.push(full);
        walk(full);
      }
    }
    walk(apiDir);
    expect(offenders).toEqual([]);
  });

  it("HR aggregates suppresses employee-count cells under k=5 on the real dataset", async () => {
    const { GET: aggregatesGet } = await import("@/app/api/hr/aggregates/route");
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    const request = new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) });
    const response = await aggregatesGet(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      laggingSkills: { belowOwnGrade: unknown; belowTarget: unknown; criticalBelowTarget: unknown }[];
    };
    expect(body.laggingSkills.length).toBeGreaterThan(0);
    const cells = body.laggingSkills.flatMap((s) => [s.belowOwnGrade, s.belowTarget, s.criticalBelowTarget]);
    for (const cell of cells) {
      if (typeof cell === "number") {
        // toCount(n): n<1 passes through as 0 (not suppressed), 1..4 must never leak, so 0 or >=5 only.
        expect(cell === 0 || cell >= 5).toBe(true);
      } else {
        expect(cell).toEqual({ suppressed: true });
      }
    }
  });

  it("HR noStep list is sorted by employee_id, not by score/rank", async () => {
    const { GET: aggregatesGet } = await import("@/app/api/hr/aggregates/route");
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    const request = new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) });
    const response = await aggregatesGet(request);
    const body = (await response.json()) as { noStep: { employee_id: string }[] };
    const ids = body.noStep.map((r) => r.employee_id);
    expect(ids).toEqual([...ids].sort());
  });
});

describe("security: employee responses contain no foreign employee data (T14, R-16)", () => {
  it("GET /api/employees/[id] for E0001 returns no other employee_id in the body", async () => {
    const { GET: employeeGet } = await import("@/app/api/employees/[id]/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E0001", { headers: cookieHeader(cookie) });
    const response = await employeeGet(request, { params: Promise.resolve({ id: "E0001" }) });
    expect(response.status).toBe(200);
    const text = await response.text();
    const foreignIds = [...text.matchAll(/"employee_id":"(E\d+)"/g)].map((m) => m[1]).filter((id) => id !== "E0001");
    expect(foreignIds).toEqual([]);
  });
});
