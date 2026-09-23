/**
 * Recommendations (docs/architecture.md §4). Self or HR, guard-first.
 */
import { getDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireSelfOrHr, sessionErrorResponse } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await requireSelfOrHr(request, id);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  return okResponse(recommend(id, dataset));
});
