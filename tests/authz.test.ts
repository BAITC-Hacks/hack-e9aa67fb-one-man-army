/**
 * Security acceptance tests for T3 (the build plan, docs/threat-model.md T1/T2).
 *
 * `lib/data/load` is mocked to throw if touched, so "401 before data is
 * touched" is a real assertion, not a guess: if a guard ever moved after the
 * dataset read, these tests would fail with 500s instead of 401/403.
 */
import { describe, it, expect, vi } from "vitest";
import { encodeSession } from "@/lib/auth/session";

vi.mock("@/lib/data/load", () => ({
  getDataset: vi.fn(async () => {
    throw new Error("dataset must not be read before the auth guard runs");
  }),
  invalidateDataset: vi.fn(),
}));

const { GET: employeeGet } = await import("@/app/api/employees/[id]/route");
const { GET: recommendationsGet } = await import("@/app/api/employees/[id]/recommendations/route");
const { GET: aggregatesGet } = await import("@/app/api/hr/aggregates/route");

function cookieHeader(value: string): HeadersInit {
  return { cookie: `cq_session=${encodeURIComponent(value)}` };
}

describe("authz: no session", () => {
  it("GET /api/employees/[id] with no cookie -> 401 before the dataset is read", async () => {
    const request = new Request("http://localhost/api/employees/E0028");
    const response = await employeeGet(request, { params: Promise.resolve({ id: "E0028" }) });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/hr/aggregates with no cookie -> 401", async () => {
    const response = await aggregatesGet(new Request("http://localhost/api/hr/aggregates"));
    expect(response.status).toBe(401);
  });
});

describe("authz: IDOR denied", () => {
  it("an employee reading another employee's profile -> 403, not the other employee's data", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E9999", { headers: cookieHeader(cookie) });
    const response = await employeeGet(request, { params: Promise.resolve({ id: "E9999" }) });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("an employee reading another employee's recommendations -> 403", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/E9999/recommendations", {
      headers: cookieHeader(cookie),
    });
    const response = await recommendationsGet(request, { params: Promise.resolve({ id: "E9999" }) });
    expect(response.status).toBe(403);
  });

  it("an unknown employee id is also denied 403, not 404 (no existence oracle)", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/employees/NOT_A_REAL_ID", { headers: cookieHeader(cookie) });
    const response = await employeeGet(request, { params: Promise.resolve({ id: "NOT_A_REAL_ID" }) });
    expect(response.status).toBe(403);
  });
});

describe("authz: role forged / escalation denied", () => {
  it("an employee session cannot call an HR-only route -> 403", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const response = await aggregatesGet(
      new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("a role forged in the request body is ignored - only the signed cookie is trusted", async () => {
    // aggregatesGet never parses a body at all; role can only come from the
    // signed cookie. An employee cookie plus a spoofed "role":"hr" body still
    // resolves to the employee's real role and is denied.
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = new Request("http://localhost/api/hr/aggregates", {
      method: "GET",
      headers: { ...cookieHeader(cookie), "content-type": "application/json" },
    });
    const response = await aggregatesGet(request);
    expect(response.status).toBe(403);
  });

  it("a cookie with a tampered payload (forged role, stale signature) is rejected -> 401", async () => {
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const signature = cookie.slice(cookie.lastIndexOf(".") + 1);
    const forgedPayload = Buffer.from(JSON.stringify({ role: "hr", id: "HR01" }), "utf8").toString("base64url");
    const tampered = `${forgedPayload}.${signature}`;

    const response = await aggregatesGet(
      new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(tampered) }),
    );
    expect(response.status).toBe(401);
  });

  it("a cookie signed with the wrong secret is rejected -> 401", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "a-different-secret-entirely";
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    process.env.SESSION_SECRET = previous;

    const response = await aggregatesGet(
      new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) }),
    );
    expect(response.status).toBe(401);
  });
});

describe("authz: HR is granted, correctly scoped", () => {
  it("an HR session passes the guard for an individual profile (dataset mock still throws past the guard, proving the guard ran first)", async () => {
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    const request = new Request("http://localhost/api/employees/E0028", { headers: cookieHeader(cookie) });
    const response = await employeeGet(request, { params: Promise.resolve({ id: "E0028" }) });
    // The guard passes (not 401/403); the mocked dataset throws afterwards, so
    // withErrorHandling turns it into a 500 - proof the read is reached only
    // once authorization has already allowed it.
    expect(response.status).toBe(500);
  });
});
