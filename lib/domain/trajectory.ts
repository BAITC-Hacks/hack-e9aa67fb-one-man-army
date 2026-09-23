/**
 * trajectory(emp, ds) -> Trajectory (docs/architecture.md §1).
 *
 * Target = the stated career goal if set, else the next grade up in the
 * employee's current role, else "hold" at Lead. Gaps are computed against the
 * target's role profile using EFFECTIVE levels (post pending-gain, I-06), so a
 * stale assessment with a recent completion does not show a gap that is
 * already closed (trap F-03).
 */
import type { Grade, Trajectory, GapRow } from "../contracts";
import type { Dataset, Employee } from "../data/load";
import { effectiveSkills } from "./effective";

const GRADE_ORDER: Grade[] = ["Junior", "Middle", "Senior", "Lead"];

function nextGrade(grade: Grade): Grade | null {
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx < 0 || idx >= GRADE_ORDER.length - 1) return null;
  return GRADE_ORDER[idx + 1] ?? null;
}

/** Thrown when the employee's role/grade has no catalogue profile, or their
 * skills map is empty. Callers (recommend.ts) turn this into DATA_INCOMPLETE. */
export class ProfileIncompleteError extends Error {
  constructor(employeeId: string) {
    super(`DATA_INCOMPLETE: no role profile or skills for ${employeeId}`);
    this.name = "ProfileIncompleteError";
  }
}

function buildGaps(
  requiredSkills: Record<string, number>,
  criticalSkills: string[],
  effective: EffectiveOut,
  ds: Dataset,
): GapRow[] {
  const skillNames = new Map(ds.skills.map((s) => [s.skill_id, s.name]));
  const rows: GapRow[] = [];
  for (const [skillId, required] of Object.entries(requiredSkills)) {
    const eff = effective.effective[skillId] ?? 0;
    const gap = Math.max(0, required - eff);
    if (gap <= 0) continue;
    rows.push({
      skill_id: skillId,
      name: skillNames.get(skillId) ?? skillId,
      assessed: effective.assessed[skillId] ?? 0,
      effective: eff,
      required,
      gap,
      critical: criticalSkills.includes(skillId),
      pendingFrom: effective.pending
        .filter((p) => p.skill_id === skillId)
        .map((p) => ({ event_id: p.event_id, date: p.date })),
    });
  }
  // Critical first, then largest gap, then skill_id - deterministic.
  rows.sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap || a.skill_id.localeCompare(b.skill_id));
  return rows;
}

type EffectiveOut = ReturnType<typeof effectiveSkills>;

export function trajectory(emp: Employee, ds: Dataset): Trajectory {
  const hasOwnProfile = ds.roleProfiles.some((p) => p.role === emp.role && p.grade === emp.grade);
  if (!hasOwnProfile || Object.keys(emp.skills).length === 0) {
    throw new ProfileIncompleteError(emp.employee_id);
  }

  const effective = effectiveSkills(emp, ds.history, ds.events);

  const targetRole = emp.career_goal?.target_role ?? emp.role;
  const targetGrade: Grade = emp.career_goal
    ? emp.career_goal.target_grade
    : (nextGrade(emp.grade) ?? emp.grade);
  const source: "goal" | "next_grade" | "hold" = emp.career_goal
    ? "goal"
    : nextGrade(emp.grade)
      ? "next_grade"
      : "hold";

  const targetProfile = ds.roleProfiles.find((p) => p.role === targetRole && p.grade === targetGrade);
  const ownProfile = ds.roleProfiles.find((p) => p.role === emp.role && p.grade === emp.grade);

  const gaps = targetProfile ? buildGaps(targetProfile.required_skills, targetProfile.critical_skills, effective, ds) : [];
  const currentGradeGaps = ownProfile
    ? buildGaps(ownProfile.required_skills, ownProfile.critical_skills, effective, ds)
    : [];

  const totalRequired = targetProfile ? Object.keys(targetProfile.required_skills).length : 0;
  const percentMet = totalRequired > 0 ? Math.round(((totalRequired - gaps.length) / totalRequired) * 100) : 100;

  return {
    current: { role: emp.role, grade: emp.grade },
    target: { role: targetRole, grade: targetGrade, source },
    gaps,
    percentMet,
    currentGradeGaps,
  };
}
