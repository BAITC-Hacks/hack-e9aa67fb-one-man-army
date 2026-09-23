/**
 * Login picker source (docs/architecture.md §4). No guard by design - it is
 * how the demo login page lists identities - but the DTO is a strict
 * whitelist: no names, skills or history. See lib/auth/session.ts for the
 * routes that DO require a session.
 */
import { getDataset } from "@/lib/data/load";
import { withErrorHandling, okResponse } from "@/lib/http/validate";

export const GET = withErrorHandling(async () => {
  const dataset = await getDataset();
  const list = dataset.employees.map((employee) => ({
    employee_id: employee.employee_id,
    role: employee.role,
    grade: employee.grade,
  }));
  return okResponse(list);
});
