/**
 * HR aggregates (docs/architecture.md §4). HR only; k>=5 suppression happens
 * server-side inside `hrAggregates` itself, not here and not in the UI.
 */
import { getDataset } from "@/lib/data/load";
import { hrAggregates } from "@/lib/domain/hr";
import { withErrorHandling, okResponse } from "@/lib/http/validate";
import { requireHr, sessionErrorResponse } from "@/lib/auth/session";

export const GET = withErrorHandling(async (request: Request) => {
  try {
    await requireHr(request);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const dataset = await getDataset();
  return okResponse(hrAggregates(dataset));
});
