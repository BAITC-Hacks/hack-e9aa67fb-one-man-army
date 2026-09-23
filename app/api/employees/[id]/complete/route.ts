/**
 * Complete an event (docs/architecture.md §4). Self only - HR cannot complete
 * on an employee's behalf: development is voluntary, and coercion is the main
 * predictor of failure. HR sessions are refused 403 (fail closed) before any
 * data is read. Eligibility is re-checked server-side inside `completeEvent`
 * regardless of what the client sent.
 */
import { z } from "zod";
import { getDataset } from "@/lib/data/load";
import { completeEvent } from "@/lib/domain/progress";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireEmployeeSelf, sessionErrorResponse } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CompleteRequest = z.object({ event_id: z.string().min(1) });

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await requireEmployeeSelf(request, id);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const body = await parseBody(request, CompleteRequest);
  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  try {
    const result = await completeEvent(id, body.event_id, { role: "employee", id });
    return okResponse(result);
  } catch {
    return errorResponse("NOT_ELIGIBLE", "This event cannot be completed for this employee.", 409);
  }
});
