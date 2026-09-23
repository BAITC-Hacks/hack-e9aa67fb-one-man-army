/**
 * Deterministic decision rules.
 *
 * Eligibility, authorisation and anything with a legal or financial
 * consequence is decided here, in code, never by a model. A model may *suggest*
 * inputs; this engine decides. Every decision carries the rule trace that
 * produced it, so an official can see exactly why.
 */

export interface RuleContext<TFacts> {
  facts: TFacts;
}

export interface Rule<TFacts> {
  id: string;
  /** Plain-language statement, ideally quoting the governing regulation. */
  description: string;
  /** Citation for the norm this encodes, e.g. a decree article. */
  source?: string;
  evaluate: (context: RuleContext<TFacts>) => RuleOutcome;
}

export type RuleOutcome =
  | { status: "pass"; detail?: string }
  | { status: "fail"; detail: string }
  /**
   * The rule could not be evaluated: a fact is missing, or a source that would
   * supply it was unreachable. This must NEVER collapse into "fail" - telling an
   * employee they are ineligible because a data source was down is a wrong
   * answer wearing the clothes of a decision.
   */
  | { status: "undetermined"; detail: string }
  | { status: "not-applicable"; detail?: string };

export interface RuleTraceEntry {
  ruleId: string;
  description: string;
  source?: string;
  status: RuleOutcome["status"];
  detail?: string;
}

export interface Decision {
  /**
   * Three-valued on purpose. `undetermined` is the honest answer when a fact is
   * missing, and it is what routes a case to a human instead of refusing it.
   */
  status: "granted" | "denied" | "undetermined";
  /** True only when status is "granted". Fails closed. */
  granted: boolean;
  trace: RuleTraceEntry[];
  /** The first failing rule, which is the one to show the employee. */
  blockedBy?: RuleTraceEntry;
  /** Rules that could not be evaluated. Non-empty when status is "undetermined". */
  undeterminedBy: RuleTraceEntry[];
  /** Always present, always safe to show a human. Never an empty refusal. */
  reason: string;
}

export function evaluateRules<TFacts>(
  rules: Rule<TFacts>[],
  facts: TFacts,
): Decision {
  const trace: RuleTraceEntry[] = [];

  for (const rule of rules) {
    let outcome: RuleOutcome;
    try {
      outcome = rule.evaluate({ facts });
    } catch (error) {
      // A throwing rule is treated as a failure, never as a pass.
      outcome = {
        status: "fail",
        detail: `Rule threw: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    trace.push({
      ruleId: rule.id,
      description: rule.description,
      source: rule.source,
      status: outcome.status,
      detail: outcome.detail,
    });
  }

  const blockedBy = trace.find((entry) => entry.status === "fail");
  const undeterminedBy = trace.filter((entry) => entry.status === "undetermined");
  const applicable = trace.filter((entry) => entry.status !== "not-applicable");

  // A definite failure outranks an unknown: if one condition is provably not
  // met, the answer is "denied" however many other facts are missing.
  let status: Decision["status"];
  let reason: string;

  if (blockedBy) {
    status = "denied";
    reason = blockedBy.detail ?? blockedBy.description;
  } else if (undeterminedBy.length > 0) {
    status = "undetermined";
    reason = `Cannot decide yet: ${undeterminedBy
      .map((entry) => entry.detail ?? entry.description)
      .join("; ")}`;
  } else if (applicable.length === 0) {
    // Nothing authorised this. Fail closed - but say why, rather than
    // returning a refusal with no reason attached.
    status = "undetermined";
    reason = "No rule applies to this case, so it cannot be decided automatically.";
  } else {
    status = "granted";
    reason = "All applicable conditions are met.";
  }

  return { status, granted: status === "granted", trace, blockedBy, undeterminedBy, reason };
}
