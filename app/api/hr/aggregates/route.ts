/**
 * HR aggregates (docs/architecture.md §4). HR only; k>=5 suppression happens
 * server-side inside `hrAggregates` itself, not here and not in the UI.
 */
import { getDataset } from "@/lib/data/load";
import { hrAggregates } from "@/lib/domain/hr";
import { withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireHr, sessionErrorResponse } from "@/lib/auth/session";
import { auditHrAggregatesView } from "@/lib/audit/hr-access";

export const GET = withErrorHandling(async (request: Request) => {
  let hrId: string;
  try {
    const session = await requireHr(request);
    hrId = session.role === "hr" ? session.id : "HR01";
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  // T5: an HR read of aggregate analytics is audited before data is returned;
  // if the audit write fails the view is denied (fail closed).
  try {
    await auditHrAggregatesView(hrId);
  } catch {
    console.error("[audit] HR aggregates-view audit write failed; view denied");
    return errorResponse("AUDIT_UNAVAILABLE", "Unable to record required audit event.", 503);
  }

  const dataset = await getDataset();
  return okResponse(hrAggregates(dataset));
});
