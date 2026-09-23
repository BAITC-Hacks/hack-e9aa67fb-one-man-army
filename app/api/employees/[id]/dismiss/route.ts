/**
 * Dismiss a recommendation (docs/architecture.md §4). Self only - HR cannot
 * dismiss on an employee's behalf. Appends to the `dismissals.jsonl` overlay
 * (docs/architecture.md §1 load/merge order) and returns refreshed recs.
 */
import { z } from "zod";
import { getDataset, invalidateDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { appendJsonl } from "@/lib/store/jsonl";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireEmployeeSelf, sessionErrorResponse } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const DismissRequest = z.object({ event_id: z.string().min(1) });

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await requireEmployeeSelf(request, id);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const body = await parseBody(request, DismissRequest);
  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  await appendJsonl("dismissals.jsonl", {
    employee_id: id,
    event_id: body.event_id,
    at: new Date().toISOString(),
  });
  invalidateDataset();

  await recordAudit({
    actor: { id, role: "employee", label: id },
    action: "recommendation.dismiss",
    subject: { type: "event", id: body.event_id },
    outcome: "allowed",
    reason: `Employee ${id} dismissed recommendation ${body.event_id}.`,
    evidence: [],
  });

  const refreshed = await getDataset();
  return okResponse(recommend(id, refreshed));
});
