/**
 * Grade-transition path (O-01, review-1430 #O-01). Same authz shape as
 * recommendations: self or HR, guard-first, fail closed.
 */
import { getDataset } from "@/lib/data/load";
import { gradePath, GradePathProfileIncompleteError } from "@/lib/domain/gradePath";
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
  const employee = dataset.employees.find((e) => e.employee_id === id);
  if (!employee) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  try {
    return okResponse(gradePath(employee, dataset));
  } catch (error) {
    if (error instanceof GradePathProfileIncompleteError) {
      return errorResponse("DATA_INCOMPLETE", "Employee profile has no role profile or skills.", 422);
    }
    throw error;
  }
});
