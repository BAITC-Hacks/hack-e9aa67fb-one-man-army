/**
 * Grounding check for AI explanation text (ADR-0007; docs/threat-model.md T13).
 *
 * The model may only phrase what the deterministic engine already computed.
 * Every number in the text must trace back to a factor or an expected skill
 * change, and every `SK_*`/`EV_*` id must be one the engine actually used.
 * At least 3 distinct factor kinds must be cited, matching R-04's "no
 * single-field AI" rule. Failing any of this is not an error - it is the
 * signal to fall back to the deterministic template.
 *
 * Kind citation only counts a factor that actually contributed (`raw !== 0`):
 * a factor's constant `weight` and a bare "0" are excluded from evidence, so
 * a zero-contribution factor (e.g. `career_goal: hasGoal=0`) can no longer be
 * "cited" for free just because its weight or contribution happens to render
 * as a common digit somewhere else in the text.
 */
import type { Factor, FactorKind } from "../contracts";

export interface GroundingInput {
  factors: Factor[];
  expected?: Array<{ skill_id: string; from: number; to: number; max_level: number }>;
}

export type GroundingResult = { grounded: true } | { grounded: false; reason: string };

const ID_PATTERN = /\b(?:SK|EV)_[A-Z0-9_]+\b/g;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

export function groundingCheck(text: string, input: GroundingInput): GroundingResult {
  const allowedNumbers = new Set<string>();
  const allowedIds = new Set<string>();
  const kindsAvailable: Array<{ kind: FactorKind; tokens: string[] }> = [];

  for (const factor of input.factors) {
    const numberTokens = [String(factor.raw), String(factor.contribution)];
    // Every value (string or number) is a candidate citation token - a grade
    // name ("Senior") or a format ("self_paced") is just as valid evidence
    // that a kind was discussed as a number is.
    const valueTokens: string[] = [];
    for (const value of Object.values(factor.values)) {
      valueTokens.push(String(value));
      if (typeof value === "number") numberTokens.push(String(value));
      else if (ID_PATTERN.test(value)) allowedIds.add(value);
      ID_PATTERN.lastIndex = 0;
    }
    // `weight` is a fixed config constant, not a fact about this employee -
    // it is a valid number to appear in text (so it doesn't false-fail
    // grounding) but must never count as evidence that a kind was cited.
    allowedNumbers.add(String(factor.weight));
    numberTokens.forEach((n) => allowedNumbers.add(n));

    // Only a factor that actually contributed (or, for a negative-weight
    // factor like the participation penalty, actively worked against the
    // score) is eligible to be "cited" - and a bare "0" never counts as
    // evidence on its own, since it signals absence, not a cited fact.
    if (factor.raw !== 0) {
      const citeTokens = [...new Set([...numberTokens, ...valueTokens])].filter((token) => token !== "0");
      kindsAvailable.push({ kind: factor.kind, tokens: citeTokens });
    }
  }
  for (const item of input.expected ?? []) {
    allowedNumbers.add(String(item.from));
    allowedNumbers.add(String(item.to));
    allowedNumbers.add(String(item.max_level));
    allowedIds.add(item.skill_id);
  }

  // Ids first: strip them before scanning numbers so digits inside an id
  // (e.g. "EV_006") are never mistaken for a bare, ungrounded number.
  const idsInText = text.match(ID_PATTERN) ?? [];
  for (const id of idsInText) {
    if (!allowedIds.has(id)) {
      return { grounded: false, reason: `Id "${id}" does not appear in the engine's factors/expected.` };
    }
  }
  const textWithoutIds = text.replace(ID_PATTERN, " ");

  const numbersInText = textWithoutIds.match(NUMBER_PATTERN) ?? [];
  for (const raw of numbersInText) {
    const normalized = String(Number(raw));
    if (!allowedNumbers.has(raw) && !allowedNumbers.has(normalized)) {
      return { grounded: false, reason: `Number "${raw}" does not appear in the engine's factors/expected.` };
    }
  }

  const kindsCited = new Set<FactorKind>();
  for (const { kind, tokens } of kindsAvailable) {
    if (tokens.some((token) => text.includes(token))) kindsCited.add(kind);
  }
  if (kindsCited.size < 3) {
    return {
      grounded: false,
      reason: `Only ${kindsCited.size} distinct factor kind(s) are cited in the text; at least 3 are required.`,
    };
  }

  return { grounded: true };
}
