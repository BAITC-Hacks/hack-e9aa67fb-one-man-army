import { completedActivities } from "./completed";
/**
 * Grounded context for AI development suggestions (operator-approved
 * extension, 2026-09-23). Shown only when `recommend()` returns NO catalogue
 * recommendation for one of three reasons: ALL_DONE, PREREQ_BLOCKED,
 * CATALOGUE_GAP. Everything the model is later shown comes from this
 * function's output, never from raw employee free text, so there is nothing
 * here for prompt injection to widen (lib/ai/suggest.ts consumes it).
 */
import type { Dataset } from "../data/load";
import type { NoStepReason } from "../contracts";
import { trajectory } from "./trajectory";
import { effectiveSkills } from "./effective";
import { recommend } from "./recommend";

export interface SuggestGapSkill {
  skill_id: string;
  name: string;
  effective: number;
  required: number;
  critical: boolean;
}

export interface SuggestBlockedEvent {
  event_id: string;
  title: string;
  failedRule: string;
  detail: string;
  /** Present only for "unlockable" events (role+grade match, develops a gap
   * skill, blocked ONLY by prereqs-met) - the exact skill/levels a
   * prerequisite_path suggestion may cite. */
  missingPrereq?: { skill_id: string; name: string; required: number; effective: number };
}

export interface SuggestMasteredSkill {
  skill_id: string;
  name: string;
  level: number;
}

export type SuggestNoStepReason = Extract<NoStepReason, "ALL_DONE" | "PREREQ_BLOCKED" | "CATALOGUE_GAP">;

export interface SuggestContext {
  employee_id: string;
  role: string;
  grade: string;
  target_role: string;
  target_grade: string;
  noStep: SuggestNoStepReason;
  gapSkills: SuggestGapSkill[];
  masteredSkills: SuggestMasteredSkill[];
  blockedEvents: SuggestBlockedEvent[];
  participation: { completed: number; inProgress: number; dropped: number };
  /** Employee facts the model may use to tailor a suggestion (no name, no PII). */
  profile?: {
    tenure_months: number;
    work_format: string;
    career_goal: { target_role: string; target_grade: string } | null;
    last_review_date: string;
  };
  /** Per activity format: how often the employee completed vs skipped
   * (dropped / no-show / declined) - lets the model prefer formats they finish. */
  participationByFormat?: Record<string, { completed: number; skipped: number }>;
  /** Most recent completions, newest first. Titles are deliberately omitted:
   * the rationale check rejects any event title outside the item's own set. */
  recentCompleted?: { type: string; format: string; date: string; skills_raised: string[] }[];
  /** Every event title / skill name in the dataset, not just this context's
   * slice - lets the rationale-safety check in lib/ai/suggest.ts reject any
   * suggestion that names an event or skill outside its own allowed set,
   * even one that legitimately exists elsewhere in the catalogue. */
  allEventTitles: string[];
  allSkillNames: string[];
}

const ELIGIBLE_REASONS: ReadonlySet<NoStepReason> = new Set(["ALL_DONE", "PREREQ_BLOCKED", "CATALOGUE_GAP"]);

function isEligibleReason(reason: NoStepReason | null): reason is SuggestNoStepReason {
  return reason !== null && ELIGIBLE_REASONS.has(reason);
}

/**
 * Returns null when this employee is not in the noStep-with-no-catalogue-step
 * case this feature targets (e.g. they have recommendations, or noStep is
 * AT_TOP_NO_GAP / NO_GAP_TO_NEXT / LOW_FIT / DATA_INCOMPLETE) - the caller
 * (the API route) turns null into `applicable: false`, never an error.
 */
export function buildSuggestContext(empId: string, ds: Dataset): SuggestContext | null {
  const emp = ds.employees.find((e) => e.employee_id === empId);
  if (!emp) return null;

  const recs = recommend(empId, ds);
  if (recs.recommendations.length > 0 || !isEligibleReason(recs.noStep)) return null;

  let traj: ReturnType<typeof trajectory>;
  try {
    traj = trajectory(emp, ds);
  } catch {
    return null;
  }

  const effective = effectiveSkills(emp, ds.history, ds.events).effective;
  const skillNames = new Map(ds.skills.map((s) => [s.skill_id, s.name]));

  const gapSkills: SuggestGapSkill[] = traj.gaps.map((g) => ({
    skill_id: g.skill_id,
    name: g.name,
    effective: g.effective,
    required: g.required,
    critical: g.critical,
  }));
  const gapSkillIds = new Set(gapSkills.map((g) => g.skill_id));

  const ownProfile = ds.roleProfiles.find((p) => p.role === emp.role && p.grade === emp.grade);
  const masteredSkills: SuggestMasteredSkill[] = ownProfile
    ? Object.entries(ownProfile.required_skills)
        .filter(([skillId, required]) => (effective[skillId] ?? 0) >= required)
        .map(([skillId]) => ({
          skill_id: skillId,
          name: skillNames.get(skillId) ?? skillId,
          level: effective[skillId] ?? 0,
        }))
        .slice(0, 5)
    : [];

  // "Unlockable": targets this employee's own role AND grade, develops a
  // gap skill, and the ONLY reason it is blocked is prereqs-met (failedRule
  // is the first-failing rule in fixed order - not-mandatory, audience-role,
  // audience-grade, prereqs-met, ... - so failedRule === "prereqs-met"
  // already guarantees role/grade passed). Role/grade-mismatched or
  // otherwise-blocked events are never offered as a prerequisite path
  // (fixes: PREREQ_BLOCKED suggestions citing an event the employee's role
  // isn't even targeted by, e.g. E0065/EV_007).
  const eventById = new Map(ds.events.map((e) => [e.event_id, e]));
  const blockedEvents: SuggestBlockedEvent[] = recs.blocked
    .filter((b) => {
      const event = eventById.get(b.event_id);
      if (!event) return false;
      if (!event.target_roles.includes(emp.role) || !event.target_grades.includes(emp.grade)) return false;
      if (!event.develops_skills.some((d) => gapSkillIds.has(d.skill_id))) return false;
      return b.failedRule === "prereqs-met";
    })
    .map((b) => {
      const event = eventById.get(b.event_id)!;
      let missingPrereq: SuggestBlockedEvent["missingPrereq"];
      for (const [skillId, required] of Object.entries(event.prerequisites)) {
        const have = effective[skillId] ?? 0;
        if (have < required) {
          missingPrereq = { skill_id: skillId, name: skillNames.get(skillId) ?? skillId, required, effective: have };
          break;
        }
      }
      return { event_id: b.event_id, title: b.title, failedRule: b.failedRule, detail: b.detail, missingPrereq };
    })
    .slice(0, 5);

  const own = ds.history.filter((h) => h.employee_id === empId);
  const participation = {
    completed: own.filter((h) => h.status === "completed").length,
    inProgress: own.filter((h) => h.status === "in_progress").length,
    dropped: own.filter((h) => h.status === "dropped" || h.status === "no_show" || h.status === "declined").length,
  };

  const formatOf = new Map(ds.events.map((e) => [e.event_id, e.format]));
  const participationByFormat: Record<string, { completed: number; skipped: number }> = {};
  for (const h of own) {
    const f = formatOf.get(h.event_id);
    if (!f) continue;
    const row = (participationByFormat[f] ??= { completed: 0, skipped: 0 });
    if (h.status === "completed") row.completed++;
    else if (h.status === "dropped" || h.status === "no_show" || h.status === "declined") row.skipped++;
  }
  const recentCompleted = completedActivities(emp, ds)
    .slice(0, 5)
    .map((c) => ({ type: c.type, format: c.format, date: c.date, skills_raised: c.skills.map((k) => k.skill_id) }));

  return {
    employee_id: empId,
    role: emp.role,
    grade: emp.grade,
    target_role: traj.target.role,
    target_grade: traj.target.grade,
    noStep: recs.noStep,
    gapSkills,
    masteredSkills,
    blockedEvents,
    participation,
    profile: {
      tenure_months: emp.tenure_months,
      work_format: emp.work_format,
      career_goal: emp.career_goal,
      last_review_date: emp.last_review_date,
    },
    participationByFormat,
    recentCompleted,
    allEventTitles: ds.events.map((e) => e.title),
    allSkillNames: ds.skills.map((s) => s.name),
  };
}
