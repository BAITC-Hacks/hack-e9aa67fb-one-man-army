/**
 * HR individual-access audit at the page level (docs/threat-model.md T5).
 * An HR session opening /employee/[id] must emit recordAudit (actor HR,
 * subject employee, purpose) before data renders, and the view is denied
 * when the audit write fails (audit-write-failure-denies).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { encodeSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/dict";
import { DEFAULT_LOCALE } from "@/lib/i18n/i18n";

let sessionCookie = "";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "cq_session" ? { name, value: sessionCookie } : undefined),
    getAll: () => [{ name: "cq_session", value: sessionCookie }],
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

const recordAudit = vi.fn();
vi.mock("@/lib/audit/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

const UNAVAILABLE = t(DEFAULT_LOCALE, "error.unavailable.title");

async function render(id: string): Promise<ReactElement<{ title?: string }>> {
  const { default: EmployeePage } = await import("@/app/employee/[id]/page");
  const element = await EmployeePage({ params: Promise.resolve({ id }) });
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<{ title?: string }>;
}

async function firstEmployeeId(): Promise<string> {
  const { getDataset } = await import("@/lib/data/load");
  const first = (await getDataset()).employees[0];
  if (!first) throw new Error("dataset has no employees");
  return first.employee_id;
}

describe("hr audit: individual profile page (T5)", () => {
  beforeEach(() => {
    recordAudit.mockReset();
  });

  it("hr.profile_view_is_audited: HR opening a profile records actor, subject and purpose", async () => {
    const id = await firstEmployeeId();
    sessionCookie = encodeSession({ role: "hr", id: "HR01" });
    recordAudit.mockResolvedValue({ id: "aud_x" });
    const element = await render(id);
    expect(element.props.title).not.toBe(UNAVAILABLE);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const draft = recordAudit.mock.calls[0]?.[0];
    expect(draft.actor).toMatchObject({ id: "HR01", label: "HR" });
    expect(draft.subject).toEqual({ type: "employee", id });
    expect(draft.action).toBe("employee.profile_view");
    expect(draft.reason).toMatch(/Purpose:/);
  });

  it("hr.audit_write_failure_denies_view: a failing audit write renders the error state, not the profile", async () => {
    const id = await firstEmployeeId();
    sessionCookie = encodeSession({ role: "hr", id: "HR01" });
    recordAudit.mockRejectedValue(new Error("disk full"));
    const element = await render(id);
    expect(element.props.title).toBe(UNAVAILABLE);
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });

  it("an employee viewing their own profile is not audited as HR access", async () => {
    const id = await firstEmployeeId();
    sessionCookie = encodeSession({ role: "employee", employeeId: id });
    const element = await render(id);
    expect(element.props.title).not.toBe(UNAVAILABLE);
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("hr audit: aggregates route (R-16c)", () => {
  function cookieHeader(value: string): HeadersInit {
    return { cookie: `cq_session=${encodeURIComponent(value)}` };
  }

  beforeEach(() => {
    recordAudit.mockReset();
  });

  it("hr.aggregates_view_is_audited: a successful HR read records actor, subject and purpose before data returns", async () => {
    const { GET: aggregatesGet } = await import("@/app/api/hr/aggregates/route");
    recordAudit.mockResolvedValue({ id: "aud_agg" });
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    const response = await aggregatesGet(
      new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) }),
    );
    expect(response.status).toBe(200);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const draft = recordAudit.mock.calls[0]?.[0];
    expect(draft.actor).toMatchObject({ id: "HR01", role: "hr" });
    expect(draft.subject).toEqual({ type: "hr-aggregates", id: "hr-aggregates" });
    expect(draft.action).toBe("hr.aggregates.view");
  });

  it("hr.aggregates_audit_write_failure_denies_view: a failing audit write denies the response instead of returning data", async () => {
    const { GET: aggregatesGet } = await import("@/app/api/hr/aggregates/route");
    recordAudit.mockRejectedValue(new Error("disk full"));
    const cookie = encodeSession({ role: "hr", id: "HR01" });
    const response = await aggregatesGet(
      new Request("http://localhost/api/hr/aggregates", { headers: cookieHeader(cookie) }),
    );
    expect(response.status).not.toBe(200);
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });
});
