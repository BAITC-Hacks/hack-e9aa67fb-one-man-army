/**
 * Signature-only stub (Batch 0). Filled in by T1.
 * See docs/architecture.md §1: trajectory(emp, ds) -> Trajectory.
 */
import type { Trajectory } from "../contracts";
import type { Dataset, Employee } from "../data/load";

export function trajectory(_emp: Employee, _ds: Dataset): Trajectory {
  throw new Error("NOT_IMPLEMENTED");
}
