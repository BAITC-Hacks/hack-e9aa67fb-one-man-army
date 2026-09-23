/**
 * Explanation endpoint (docs/architecture.md §4, §5). Only explains event ids
 * the engine actually returned - the model cannot explain, and so cannot
 * smuggle in, an event it was never given. Always 200: a failed explanation
 * degrades to the template, it never surfaces as an HTTP error.
 */
import { z } from "zod";
import { getDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { explain } from "@/lib/ai/explain";
import { Locale } from "@/lib/contracts";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireSelfOrHr, sessionErrorResponse } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ExplainRequest = z.object({
  event_ids: z.array(z.string()).min(1).max(3),
  locale: Locale,
});

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await requireSelfOrHr(request, id);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const body = await parseBody(request, ExplainRequest);
  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  const current = recommend(id, dataset);
  const byId = new Map(current.recommendations.map((rec) => [rec.event_id, rec]));

  for (const eventId of body.event_ids) {
    if (!byId.has(eventId)) {
      return errorResponse(
        "VALIDATION",
        `Event ${eventId} is not among this employee's current recommendations.`,
        422,
      );
    }
  }

  const explanations = await Promise.all(
    body.event_ids.map((eventId) => explain(byId.get(eventId)!, body.locale)),
  );
  return okResponse({ explanations });
});
