/**
 * AI development-suggestion endpoint (operator-approved extension,
 * 2026-09-23). Mirrors app/api/employees/[id]/explanations/route.ts's authz
 * exactly (employee self, or HR read-only). Only ever reasons about an
 * employee who already has NO catalogue recommendation (noStep ALL_DONE /
 * PREREQ_BLOCKED / CATALOGUE_GAP) - it never creates a catalogue event,
 * never changes a recommendation, never writes state. Always 200: a failed
 * generation degrades to the template, it never surfaces as an HTTP error.
 */
import { z } from "zod";
import { getDataset } from "@/lib/data/load";
import { buildSuggestContext } from "@/lib/domain/suggest";
import { generateSuggestions } from "@/lib/ai/suggest";
import { Locale } from "@/lib/contracts";
import { parseBody, withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireSelfOrHr, sessionErrorResponse } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SuggestRequest = z.object({ locale: Locale });

export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await requireSelfOrHr(request, id);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const body = await parseBody(request, SuggestRequest);
  const dataset = await getDataset();
  const known = dataset.employees.some((employee) => employee.employee_id === id);
  if (!known) return errorResponse("NOT_FOUND", "Unknown employee id.", 404);

  const context2 = buildSuggestContext(id, dataset);
  if (!context2) return okResponse({ applicable: false });

  const result = await generateSuggestions(context2, body.locale);
  return okResponse({ applicable: true, result });
});
