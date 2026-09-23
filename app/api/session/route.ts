/**
 * Demo login (ADR-0008). Anyone can assert any identity - that is the
 * documented trade-off for "no personal accounts" (5.6.6). What matters is
 * that once asserted, the role is signed and every other route trusts only
 * the cookie, never the request body.
 */
import { z } from "zod";
import { getDataset } from "@/lib/data/load";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { getSession, sessionCookieHeader, clearSessionCookieHeader } from "@/lib/auth/session";
import type { Session } from "@/lib/contracts";

const SessionRequest = z.discriminatedUnion("role", [
  z.object({ role: z.literal("employee"), employeeId: z.string().min(1) }),
  z.object({ role: z.literal("hr") }),
]);

export const POST = withErrorHandling(async (request) => {
  const body = await parseBody(request, SessionRequest);

  let session: Session;
  if (body.role === "employee") {
    const dataset = await getDataset();
    const known = dataset.employees.some((employee) => employee.employee_id === body.employeeId);
    if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);
    session = { role: "employee", employeeId: body.employeeId };
  } else {
    session = { role: "hr", id: "HR01" };
  }

  const response = okResponse(session);
  response.headers.append("Set-Cookie", sessionCookieHeader(session));
  return response;
});

export const GET = withErrorHandling(async (request) => {
  const session = await getSession(request);
  return okResponse(session);
});

export const DELETE = withErrorHandling(async () => {
  const response = okResponse({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookieHeader());
  return response;
});
