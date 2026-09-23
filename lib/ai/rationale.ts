/**
 * Shared human-sentence builder for explanations.
 *
 * Both the deterministic template (`./template.ts`) and the offline mock
 * "model" scenario (`./scenarios.ts`) call this, so their prose is consistent
 * and, by construction, grounded: every number/id used here is copied
 * verbatim from `factors[]`/`expected[]`, never invented (R-04, ADR-0007).
 *
 * Only factors that actually contributed (`raw !== 0`, which also covers a
 * negative participation penalty - see F5 in lib/rules/scoring.ts) are
 * eligible to appear: a zero-contribution factor is never cited as if it
 * mattered.
 */
import type { Factor, FactorKind, Locale } from "../contracts";
import { t, tf } from "../i18n/dict";

/** R-04 order: grade, skill gaps, participation history, next-level requirement first. */
const KIND_PRIORITY: FactorKind[] = [
  "grade",
  "skill_gap",
  "next_level_requirement",
  "participation_history",
  "career_goal",
  "session_availability",
  "pending_gain",
  "effort_fit",
];

function lineForKind(locale: Locale, kind: FactorKind, group: Factor[]): string | null {
  const first = group[0];
  if (!first) return null; // callers only pass non-empty groups
  switch (kind) {
    case "grade": {
      const f = first;
      return tf(locale, "rationale.grade", { grade: f.values.grade ?? "", target: f.values.targetGrade ?? "" });
    }
    case "skill_gap": {
      const critical = group.find((f) => f.code === "F1");
      const nonCritical = group.find((f) => f.code === "F2");
      if (critical && nonCritical) {
        return tf(locale, "rationale.skillGapBoth", {
          critical: critical.values.closure ?? 0,
          nonCritical: nonCritical.values.closure ?? 0,
        });
      }
      if (critical) return tf(locale, "rationale.skillGapCritical", { closure: critical.values.closure ?? 0 });
      if (nonCritical) return tf(locale, "rationale.skillGapNonCritical", { closure: nonCritical.values.closure ?? 0 });
      return null;
    }
    case "next_level_requirement": {
      const f = first;
      return tf(locale, "rationale.nextLevel", { target: f.values.target ?? "", gap: f.values.largestGap ?? 0 });
    }
    case "participation_history": {
      // F6 (format-switch signal) takes precedence when it fired: it is the
      // more actionable, neutrally-worded fact (docs/domain.md §3 F6).
      const f6 = group.find((f) => f.code === "F6");
      if (f6 && typeof f6.raw === "number" && f6.raw > 0) {
        return tf(locale, "rationale.participationFormatSwitch", {
          skipped: f6.values.skipped ?? 0,
          format: f6.values.format ?? "",
          altFormat: f6.values.altFormat ?? "",
        });
      }
      const f5 = group.find((f) => f.code === "F5") ?? first;
      return tf(locale, "rationale.participation", { count: f5.values.negativeRecords ?? f5.raw });
    }
    case "career_goal":
      return t(locale, "rationale.careerGoal");
    case "session_availability": {
      const f = first;
      return f.values.format === "self_paced"
        ? t(locale, "rationale.sessionSelfPaced")
        : t(locale, "rationale.sessionSoon");
    }
    default:
      return null;
  }
}

/** Groups by kind, keeping only factors that actually contributed (raw !== 0). */
function contributingByKind(factors: Factor[]): Map<FactorKind, Factor[]> {
  const byKind = new Map<FactorKind, Factor[]>();
  for (const factor of factors) {
    if (factor.raw === 0) continue;
    const group = byKind.get(factor.kind) ?? [];
    group.push(factor);
    byKind.set(factor.kind, group);
  }
  return byKind;
}

/**
 * Builds 3-5 short, grounded sentences, each citing a distinct contributing
 * factor kind (R-04), in priority order. Pads with a generic, still-honest
 * line if fewer than 3 factors actually contributed.
 */
export function buildWhyLines(locale: Locale, title: string, factors: Factor[]): string[] {
  const byKind = contributingByKind(factors);
  const lines: string[] = [];

  for (const kind of KIND_PRIORITY) {
    const group = byKind.get(kind);
    if (!group) continue;
    const line = lineForKind(locale, kind, group);
    if (line) lines.push(line);
    if (lines.length >= 5) break;
  }

  while (lines.length < 3) lines.push(tf(locale, "rationale.fallbackAddresses", { title }));
  return lines.slice(0, 5);
}

export function buildExpectedProgress(
  locale: Locale,
  title: string,
  expected: Array<{ skill_id: string; from: number; to: number; max_level: number }>,
): string {
  if (expected.length === 0) return tf(locale, "rationale.expectedFallback", { title });
  const rows = expected
    .map((item) => tf(locale, "recs.expectedRow", { skill: item.skill_id, from: item.from, to: item.to, max: item.max_level }))
    .join("; ");
  return `${t(locale, "rationale.expectedPrefix")}${rows}`;
}
