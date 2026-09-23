/**
 * Signature-only stubs (Batch 0). Filled in by T3.
 * See docs/architecture.md §1 and §6: reads the signed `cq_session` cookie,
 * fails closed. `requireEmployeeSelf` / `requireHr` throw 401/403.
 */
import type { Session } from "../contracts";

export async function getSession(_request: Request): Promise<Session | null> {
  throw new Error("NOT_IMPLEMENTED");
}

export async function requireEmployeeSelf(_request: Request, _employeeId: string): Promise<Session> {
  throw new Error("NOT_IMPLEMENTED");
}

export async function requireHr(_request: Request): Promise<Session> {
  throw new Error("NOT_IMPLEMENTED");
}
