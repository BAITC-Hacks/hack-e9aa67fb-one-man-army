/**
 * Deterministic kk/ru/en explanation, built only from `factors[]`/`expected[]`.
 *
 * This is both the AI-off fallback (ADR-0007) and the answer used whenever
 * the model's output fails schema validation, times out, or fails
 * `groundingCheck`. It is trivially grounded: every number and id in it is
 * copied verbatim from the engine's own output, never invented.
 */
import type { Explanation, Locale, Recommendation } from "../contracts";

const PHRASES: Record<Locale, { contributes: string; addresses: string; progress: string }> = {
  en: { contributes: "contributes", addresses: "This addresses", progress: "Expected: " },
  ru: { contributes: "вклад", addresses: "Это закрывает", progress: "Ожидается: " },
  kk: { contributes: "үлесі", addresses: "Бұл жабады", progress: "Күтілуде: " },
};

export function templateExplanation(rec: Recommendation, locale: Locale, fallbackReason: string): Explanation {
  const phrase = PHRASES[locale] ?? PHRASES.en;

  const lines = rec.factors.slice(0, 5).map((factor) => {
    const values = Object.entries(factor.values)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    return `${factor.kind}: ${phrase.contributes} ${factor.contribution} (${values})`;
  });
  while (lines.length < 3) lines.push(`${phrase.addresses} ${rec.title}.`);

  const expectedProgress =
    rec.expected.length > 0
      ? `${phrase.progress}${rec.expected
          .map((item) => `${item.skill_id} ${item.from}→${item.to} (max ${item.max_level})`)
          .join("; ")}`
      : `${phrase.progress}${rec.title}`;

  return {
    event_id: rec.event_id,
    headline: rec.title,
    why: lines.slice(0, 5),
    expected_progress: expectedProgress,
    source: "template",
    fallbackReason,
  };
}
