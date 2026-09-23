/**
 * Signature-only stub (Batch 0). Filled in by T2.
 * See docs/architecture.md §1: completeEvent(empId, eventId, actor) -> ProgressResult.
 */
import type { ProgressResult } from "../contracts";

export interface ProgressActor {
  role: "employee" | "hr";
  id: string;
}

export async function completeEvent(
  _empId: string,
  _eventId: string,
  _actor: ProgressActor,
): Promise<ProgressResult> {
  throw new Error("NOT_IMPLEMENTED");
}
