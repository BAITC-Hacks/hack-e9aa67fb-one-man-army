/**
 * recommend(empId, ds) -> RecommendationResult (docs/architecture.md §1).
 *
 * Pipeline: eligibility (lib/rules/eligibility.ts via evaluateRules) -> score
 * (lib/rules/scoring.ts) -> sort (score desc, F1 desc, duration asc, event_id
 * asc) -> diversity (no two recs whose only useful-gain skill is the same) ->
 * keep score > 0 -> top 3, else [] + a NoStepReason (docs/domain.md §3).
 *
 * The model never picks or ranks here - this is the deterministic decision
 * the LLM later rephrases (see lib/ai/explain.ts, owned by T3).
 */
import type { NoStepReason, Recommendation, RecommendationResult } from "../contracts";
import type { Dataset, Employee, Event } from "../data/load";
import { effectiveSkills, isProfileIncomplete } from "./effective";
import { engagement } from "./history";
import { trajectory, ProfileIncompleteError } from "./trajectory";
import { eligibilityRules, type EligFacts } from "../rules/eligibility";
import { evaluateRules } from "../rules/engine";
import { scoreEvent, SCORING_CONFIG } from "../rules/scoring";

function findEmployee(empId: string, ds: Dataset): Employee | undefined {
  return ds.employees.find((e) => e.employee_id === empId);
}

/** The skill_ids required by the employee's stated career goal (if any),
 * used only by the F4 career-goal-alignment factor. */
function careerGoalSkillIds(emp: Employee, ds: Dataset): Set<string> {
  if (!emp.career_goal) return new Set();
  const profile = ds.roleProfiles.find(
    (p) => p.role === emp.career_goal?.target_role && p.grade === emp.career_goal?.target_grade,
  );
  return new Set(profile ? Object.keys(profile.required_skills) : []);
}

function usefulGainSkills(event: Event, effective: Record<string, number>): string[] {
  return event.develops_skills
    .filter((d) => (effective[d.skill_id] ?? 0) < d.max_level)
    .map((d) => d.skill_id);
}

function classifyNoStep(
  emp: Employee,
  ds: Dataset,
  gapsEmpty: boolean,
  targetSource: "goal" | "next_grade" | "hold",
  blocked: { event_id: string; failedRule: string }[],
  gapSkillIds: Set<string>,
  hasEligibleCandidates: boolean,
): NoStepReason {
  if (gapsEmpty) return targetSource === "hold" ? "AT_TOP_NO_GAP" : "NO_GAP_TO_NEXT";

  // At least one event passed every eligibility rule (role, grade, prereqs,
  // repeats, session, dismissal). The catalogue is not the problem here -
  // every candidate simply scored <= 0 (e.g. a heavy F5 participation
  // penalty). That is a real, distinct case from "no eligible event exists".
  if (hasEligibleCandidates) return "LOW_FIT";

  const catalogueForRole = ds.events.filter((e) => e.target_roles.includes(emp.role));
  const gapEventIds = new Set(
    catalogueForRole.filter((e) => e.develops_skills.some((d) => gapSkillIds.has(d.skill_id))).map((e) => e.event_id),
  );
  if (gapEventIds.size === 0) return "CATALOGUE_GAP";

  // Only reason about events that actually bear on a real gap - an
  // unrelated event blocked on e.g. audience-grade must not pollute this
  // classification (that was the original bug: DATA_INCOMPLETE was a
  // catch-all whenever the blocked reasons were a mix of relevant and
  // irrelevant events).
  const relevantBlocked = blocked.filter((b) => gapEventIds.has(b.event_id));
  const reasons = new Set(relevantBlocked.map((b) => b.failedRule));
  if (reasons.has("prereqs-met") && !reasons.has("has-session")) return "PREREQ_BLOCKED";
  if (reasons.has("has-session")) return "NO_SESSION";
  // By construction every event in gapEventIds is either eligible (which
  // would have produced a candidate in `scored`, already excluded above by
  // hasEligibleCandidates) or blocked - so relevantBlocked is never empty
  // here. Whatever combination of reasons blocks them (already completed,
  // in progress, no more useful gain left, mandatory-assigned, wrong grade,
  // dismissed, ...), there is currently no actionable step for a real gap,
  // which is what ALL_DONE communicates. DATA_INCOMPLETE is reserved for
  // the two profile-validation early-returns above in `recommend()` - it is
  // never a fallback for "the classifier ran out of specific reasons".
  return "ALL_DONE";
}

export function recommend(empId: string, ds: Dataset): RecommendationResult {
  const asOf = ds.asOfDate;
  const emp = findEmployee(empId, ds);
  if (!emp || isProfileIncomplete(emp, ds)) {
    return { employee_id: empId, scoringVersion: SCORING_CONFIG.version, asOf, recommendations: [], noStep: "DATA_INCOMPLETE", blocked: [] };
  }

  let traj: ReturnType<typeof trajectory>;
  try {
    traj = trajectory(emp, ds);
  } catch (error) {
    if (error instanceof ProfileIncompleteError) {
      return { employee_id: empId, scoringVersion: SCORING_CONFIG.version, asOf, recommendations: [], noStep: "DATA_INCOMPLETE", blocked: [] };
    }
    throw error;
  }

  const effective = effectiveSkills(emp, ds.history, ds.events).effective;
  const dismissedEventIds = ds.dismissals?.[empId] ?? [];
  const goalSkillIds = careerGoalSkillIds(emp, ds);
  const gapSkillIds = new Set(traj.gaps.map((g) => g.skill_id));

  const blocked: RecommendationResult["blocked"] = [];
  const scored: { event: Event; score: number; factors: ReturnType<typeof scoreEvent>["factors"]; rules: ReturnType<typeof evaluateRules>["trace"] }[] = [];

  for (const event of ds.events) {
    const facts: EligFacts = { employee: emp, event, ds, effective, history: ds.history, dismissedEventIds };
    const decision = evaluateRules(eligibilityRules, facts);
    if (!decision.granted) {
      if (decision.blockedBy) {
        blocked.push({ event_id: event.event_id, title: event.title, failedRule: decision.blockedBy.ruleId, detail: decision.blockedBy.detail ?? decision.blockedBy.description });
      }
      continue;
    }
    const { score, factors } = scoreEvent({
      employee: emp,
      event,
      effective,
      gaps: traj.gaps,
      targetGrade: traj.target.grade,
      careerGoalSkillIds: goalSkillIds,
      engagement: engagement(empId, event, ds),
      asOfDate: asOf,
    });
    scored.push({ event, score, factors, rules: decision.trace });
  }

  const eligibleAndUseful = scored.filter((s) => s.score > 0);

  // Candidates that passed every eligibility rule but scored at or below
  // the minimum threshold must still be traceable, not silently dropped:
  // record them in `blocked` alongside the rule-level rejections.
  for (const s of scored) {
    if (s.score > 0) continue;
    blocked.push({
      event_id: s.event.event_id,
      title: s.event.title,
      failedRule: "score-threshold",
      detail: `eligible, but score ${s.score.toFixed(2)} is at or below the minimum (0)`,
    });
  }

  // Deterministic tie-break: score desc, F1 (critical closure) desc, duration asc, event_id asc.
  eligibleAndUseful.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const f1a = a.factors.find((f) => f.code === "F1")?.raw ?? 0;
    const f1b = b.factors.find((f) => f.code === "F1")?.raw ?? 0;
    if (f1b !== f1a) return f1b - f1a;
    if (a.event.duration_hours !== b.event.duration_hours) return a.event.duration_hours - b.event.duration_hours;
    return a.event.event_id.localeCompare(b.event.event_id);
  });

  // Diversity: no two picks whose useful-gain skill set is the same single skill.
  const claimedSingleSkills = new Set<string>();
  const picked: typeof eligibleAndUseful = [];
  for (const candidate of eligibleAndUseful) {
    if (picked.length >= 3) break;
    const gainSkills = usefulGainSkills(candidate.event, effective);
    const onlySkill = gainSkills.length === 1 ? gainSkills[0] : undefined;
    if (onlySkill && claimedSingleSkills.has(onlySkill)) continue;
    picked.push(candidate);
    if (onlySkill) claimedSingleSkills.add(onlySkill);
  }

  const recommendations: Recommendation[] = picked.map((s) => ({
    event_id: s.event.event_id,
    title: s.event.title,
    type: s.event.type,
    format: s.event.format,
    duration_hours: s.event.duration_hours,
    next_session: s.event.upcoming_sessions.find((d) => d >= asOf) ?? null,
    score: s.score,
    factors: s.factors,
    expected: s.event.develops_skills
      .filter((d) => (effective[d.skill_id] ?? 0) < d.max_level)
      .map((d) => ({ skill_id: d.skill_id, from: effective[d.skill_id] ?? 0, to: Math.min((effective[d.skill_id] ?? 0) + d.gain, d.max_level), max_level: d.max_level })),
    rules: s.rules,
  }));

  const noStep: NoStepReason | null =
    recommendations.length > 0
      ? null
      : classifyNoStep(emp, ds, traj.gaps.length === 0, traj.target.source, blocked, gapSkillIds, scored.length > 0);

  return { employee_id: empId, scoringVersion: SCORING_CONFIG.version, asOf, recommendations, noStep, blocked };
}
