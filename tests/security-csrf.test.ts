/**
 * CSRF / cross-origin guard (docs/threat-model.md T16). Enforced centrally in
 * withErrorHandling, so it is tested both on the helper and through a real
 * state-changing route handler.
 */
import { describe, it, expect } from "vitest";
import { crossOriginViolation } from "@/lib/http/origin";
import { withErrorHandling } from "@/lib/http/validate";
import { encodeSession, sessionCookieHeader } from "@/lib/auth/session";

const ok = withErrorHandling(async () => new Response("handled", { status: 200 }));

function post(headers: Record<string, string>, method = "POST"): Request {
  return new Request("http://localhost:3000/api/employees/E0001/complete", {
    method,
    headers: { host: "localhost:3000", "content-type": "application/json", ...headers },
    body: method === "GET" ? undefined : "{}",
  });
}

describe("http: cross-origin state-changing requests (T16)", () => {
  it("http.cross_origin_post_rejected: POST with a foreign Origin is 403 and never reaches the handler", async () => {
    const response = await ok(post({ origin: "http://evil.example" }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("CROSS_ORIGIN_FORBIDDEN");
  });

  it("rejects PUT and DELETE with a foreign Origin", async () => {
    expect((await ok(post({ origin: "http://evil.example" }, "PUT"))).status).toBe(403);
    expect((await ok(post({ origin: "http://evil.example" }, "DELETE"))).status).toBe(403);
  });

  it("rejects same-host-different-port and opaque 'null' origins", async () => {
    expect((await ok(post({ origin: "http://localhost:4000" }))).status).toBe(403);
    expect((await ok(post({ origin: "null" }))).status).toBe(403);
    expect((await ok(post({ origin: "not a url" }))).status).toBe(403);
  });

  it("rejects Sec-Fetch-Site: cross-site even without Origin", async () => {
    expect((await ok(post({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });

  it("allows a same-origin POST (Playwright/browser from http://localhost:3000)", async () => {
    const response = await ok(post({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }));
    expect(response.status).toBe(200);
  });

  it("allows a POST with no Origin (non-browser client) and any GET", async () => {
    expect((await ok(post({}))).status).toBe(200);
    expect((await ok(post({ origin: "http://evil.example" }, "GET"))).status).toBe(200);
  });

  it("the real /complete route rejects a cross-origin POST even with a valid session", async () => {
    const { POST } = await import("@/app/api/employees/[id]/complete/route");
    const cookie = encodeSession({ role: "employee", employeeId: "E0001" });
    const request = post({ origin: "http://evil.example", cookie: `cq_session=${encodeURIComponent(cookie)}` });
    const response = await POST(request, { params: Promise.resolve({ id: "E0001" }) });
    expect(response.status).toBe(403);
  });

  it("helper returns null for safe methods and a reason for a mismatch", () => {
    expect(crossOriginViolation(post({ origin: "http://evil.example" }, "GET"))).toBeNull();
    expect(crossOriginViolation(post({ origin: "http://evil.example" }))).toBe("origin mismatch");
  });

  it("session cookie is HttpOnly and SameSite=Strict", () => {
    const header = sessionCookieHeader({ role: "hr", id: "HR01" });
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Strict/);
  });
});
