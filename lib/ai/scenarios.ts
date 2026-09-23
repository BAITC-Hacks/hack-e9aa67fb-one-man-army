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
import type { MockScenario } from "./mock-provider";

export const scenarios: MockScenario[] = [];

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
