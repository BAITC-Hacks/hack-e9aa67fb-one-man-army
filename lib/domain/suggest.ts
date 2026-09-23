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

  const eventById = new Map(ds.events.map((e) => [e.event_id, e]));
  const blockedEvents: SuggestBlockedEvent[] = recs.blocked
    .filter((b) => {
      const event = eventById.get(b.event_id);
      return event ? event.develops_skills.some((d) => gapSkillIds.has(d.skill_id)) : false;
    })
    .map((b) => ({ event_id: b.event_id, title: b.title, failedRule: b.failedRule, detail: b.detail }))
    .slice(0, 5);

  const own = ds.history.filter((h) => h.employee_id === empId);
  const participation = {
    completed: own.filter((h) => h.status === "completed").length,
    inProgress: own.filter((h) => h.status === "in_progress").length,
    dropped: own.filter((h) => h.status === "dropped" || h.status === "no_show" || h.status === "declined").length,
  };

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
  };
}
