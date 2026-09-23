/**
 * Stub (Batch 0). Filled in by T3: generateStructured -> groundingCheck ->
 * templateExplanation fallback (docs/architecture.md §1, §5). Until then this
 * always returns a template placeholder so callers can develop against a real
 * `Explanation` shape.
 */
import type { Explanation, Locale, Recommendation } from "../contracts";

export async function explain(rec: Recommendation, _locale: Locale): Promise<Explanation> {
  return {
    event_id: rec.event_id,
    headline: rec.title,
    why: [
      "Placeholder rationale: lib/ai/explain.ts is not implemented yet.",
      "T3 wires generateStructured, groundingCheck and the template fallback here.",
      "This text is never shown as an AI explanation; source is always template.",
    ],
    expected_progress: "Placeholder: expected progress text is not implemented yet.",
    source: "template",
    fallbackReason: "NOT_IMPLEMENTED",
  };
}
