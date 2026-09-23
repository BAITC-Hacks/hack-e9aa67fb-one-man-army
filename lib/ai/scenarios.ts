/**
 * Scripted behaviour for the offline provider.
 *
 * Replace these with scenarios for the real challenge. Keep them honest: a
 * scripted answer must be something the live model plausibly returns, because
 * the demo shows this output as the product's behaviour.
 *
 * Respect the requested locale. A scripted English summary rendered inside a
 * Russian page is an immediately visible flaw in a trilingual demo, and it is
 * the easiest kind to miss - the tests pass, but the screenshot shows it.
 */
import type { Factor, Locale } from "../contracts";
import type { MockScenario } from "./mock-provider";

interface ExplainPromptData {
  title: string;
  factors: Factor[];
  expected: Array<{ skill_id: string; from: number; to: number; max_level: number }>;
}

const CONNECT: Record<Locale, { contributes: string; addresses: string; progress: string }> = {
  en: { contributes: "contributes", addresses: "Fits your track for", progress: "Expected: " },
  ru: { contributes: "вклад", addresses: "Подходит для вашего трека:", progress: "Ожидается: " },
  kk: { contributes: "үлесі", addresses: "Сіздің бағытыңызға сай:", progress: "Күтілуде: " },
};

/**
 * Explanation scenario (ADR-0007, docs/architecture.md §5).
 *
 * `lib/ai/explain.ts` builds a data-only prompt starting with
 * "TASK: explain_event". This scenario echoes ONLY the numbers/ids it is
 * given in `DATA`, in the requested locale, so the reply always passes
 * `groundingCheck` offline - the same discipline a real model is instructed
 * to follow, made deterministic for the demo.
 */
export const scenarios: MockScenario[] = [
  {
    name: "explain-event",
    match: (prompt) => prompt.startsWith("TASK: explain_event"),
    respond: (prompt) => {
      const localeMatch = /LOCALE: (\w+)/.exec(prompt);
      const locale = (localeMatch?.[1] as Locale | undefined) ?? "en";
      const marker = "DATA:\n";
      const data = JSON.parse(prompt.slice(prompt.indexOf(marker) + marker.length)) as ExplainPromptData;
      const phrase = CONNECT[locale] ?? CONNECT.en;

      const why = data.factors.slice(0, 4).map((factor) => {
        const values = Object.entries(factor.values)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ");
        return `${factor.kind}: ${phrase.contributes} ${factor.contribution} (${values})`;
      });
      while (why.length < 3) why.push(`${phrase.addresses} ${data.title}.`);

      const expected_progress =
        data.expected.length > 0
          ? `${phrase.progress}${data.expected
              .map((item) => `${item.skill_id} ${item.from}→${item.to} (max ${item.max_level})`)
              .join("; ")}`
          : `${phrase.progress}${data.title}`;

      return {
        kind: "object",
        value: { headline: data.title, why, expected_progress },
      };
    },
  },
];

/**
 * There is deliberately NO default fallback export.
 *
 * An earlier version of this file returned English developer prose
 * ("Offline demo model. No scenario is scripted...") as if it were a model
 * answer. That is the worst possible behaviour for an unscripted input:
 *
 *   - against a structured-output schema it fails validation and, uncaught,
 *     becomes a 500 in front of a judge;
 *   - caught but rendered, it prints a developer note onto a citizen-facing
 *     page, in the wrong language.
 *
 * With no fallback, `createMockModel` raises `NoMockScenarioError` instead: a
 * named, catchable condition your degraded path handles explicitly. That is the
 * difference between "the system says it cannot determine this yet" and "the
 * system is broken".
 *
 * A judge WILL type their own sentence. Build that path in the same hour as the
 * happy path, not after it.
 *
 * If you do want a graceful scripted default, pass one explicitly and make it
 * schema-shaped - not prose:
 *
 *   createMockModel("demo", {
 *     scenarios,
 *     fallback: () => ({ kind: "object", value: { status: "undetermined", missingFacts: [] } }),
 *   });
 */
