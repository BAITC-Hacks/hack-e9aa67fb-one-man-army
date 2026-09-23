/**
 * Signature-only stub (Batch 0). Filled in by T1.
 * See docs/architecture.md §1: recommend(empId, ds) -> RecommendationResult.
 */
import type { RecommendationResult } from "../contracts";
import type { Dataset } from "../data/load";

export function recommend(_empId: string, _ds: Dataset): RecommendationResult {
  throw new Error("NOT_IMPLEMENTED");
}
