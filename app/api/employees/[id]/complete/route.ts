/**
 * Complete an event (docs/architecture.md §4). Self, or HR acting on an
 * employee's behalf (audited). Eligibility is re-checked server-side inside
 * `completeEvent` regardless of what the client sent.
 */
import { z } from "zod";
import { getDataset } from "@/lib/data/load";
import { completeEvent, type ProgressActor } from "@/lib/domain/progress";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireSelfOrHr, sessionErrorResponse } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CompleteRequest = z.object({ event_id: z.string().min(1) });

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  let isHr = false;
  try {
    isHr = (await requireSelfOrHr(request, id)).isHr;
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const body = await parseBody(request, CompleteRequest);
  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  const actor: ProgressActor = isHr ? { role: "hr", id: "HR01" } : { role: "employee", id };
  if (isHr) {
    await recordAudit({
      actor: { id: "HR01", role: "officer", label: "HR" },
      action: "employee.complete_on_behalf",
      subject: { type: "employee", id },
      outcome: "allowed",
      reason: `HR completed event ${body.event_id} on behalf of employee ${id}.`,
      evidence: [body.event_id],
    });
  }

  try {
    const result = await completeEvent(id, body.event_id, actor);
    return okResponse(result);
  } catch {
    return errorResponse("NOT_ELIGIBLE", "This event cannot be completed for this employee.", 409);
  }
});
