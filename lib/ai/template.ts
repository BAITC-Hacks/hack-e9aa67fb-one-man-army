/**
 * Deterministic kk/ru/en explanation, built only from `factors[]`/`expected[]`.
 *
 * This is both the AI-off fallback (ADR-0007) and the answer used whenever
 * the model's output fails schema validation, times out, or fails
 * `groundingCheck`. It is trivially grounded: every number and id in it is
 * copied verbatim from the engine's own output, never invented. Sentences are
 * built by `./rationale.ts`, the same builder the offline mock scenario uses,
 * so both read as human prose, not a `key=value` debug dump (R-04).
 */
import type { Explanation, Locale, Recommendation } from "../contracts";
import { buildWhyLines, buildExpectedProgress } from "./rationale";

export function templateExplanation(rec: Recommendation, locale: Locale, fallbackReason: string): Explanation {
  return {
    event_id: rec.event_id,
    headline: rec.title,
    why: buildWhyLines(locale, rec.title, rec.factors),
    expected_progress: buildExpectedProgress(locale, rec.title, rec.expected),
    source: "template",
    fallbackReason,
  };
}
