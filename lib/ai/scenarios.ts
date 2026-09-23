/**
 * Scripted behaviour for the offline provider.
 *
 * Scenarios for the career-development assistant. Keep them honest: a
 * scripted answer must be something the live model plausibly returns, because
 * the demo shows this output as the product's behaviour.
 *
 * Respect the requested locale. A scripted English summary rendered inside a
 * Russian page is an immediately visible flaw in a trilingual demo, and it is
 * the easiest kind to miss - the tests pass, but the screenshot shows it.
 */
import type { Factor, Locale } from "../contracts";
import type { MockScenario } from "./mock-provider";
import { buildWhyLines, buildExpectedProgress } from "./rationale";

interface ExplainPromptData {
  title: string;
  factors: Factor[];
  expected: Array<{ skill_id: string; from: number; to: number; max_level: number }>;
}

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

      const why = buildWhyLines(locale, data.title, data.factors);
      const expected_progress = buildExpectedProgress(locale, data.title, data.expected);

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
