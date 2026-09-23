/**
 * Employee profile (docs/architecture.md §4). Guard runs before any dataset
 * read, so a missing/forged cookie or a foreign employee id fails 401/403
 * before data is touched. HR reads are audited (docs/threat-model.md T5).
 */
import { getDataset } from "@/lib/data/load";
import { trajectory } from "@/lib/domain/trajectory";
import { withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireSelfOrHr, sessionErrorResponse } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  let isHr = false;
  try {
    isHr = (await requireSelfOrHr(request, id)).isHr;
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const dataset = await getDataset();
  const employee = dataset.employees.find((e) => e.employee_id === id);
  if (!employee) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  if (isHr) {
    await recordAudit({
      actor: { id: "HR01", role: "officer", label: "HR" },
      action: "employee.profile_view",
      subject: { type: "employee", id },
      outcome: "allowed",
      reason: `HR viewed the profile of employee ${id}.`,
      evidence: [],
    });
  }

  const history = dataset.history.filter((row) => row.employee_id === id);
  return okResponse({ employee, trajectory: trajectory(employee, dataset), history });
});
