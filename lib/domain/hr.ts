/**
 * Filled in by T2. See docs/architecture.md §1: hrAggregates(ds) -> HrAggregates
 * and docs/domain.md ("which skills lag most often, who has no recommended
 * step, and participation by activity"). Every group cell with n < 5 is
 * suppressed (k-anonymity, docs/threat-model.md T5/T7).
 *
 * "Lagging" and "target" use T1's pending-gain "effective" level
 * (`lib/domain/effective.ts`), not the raw stored `skills[skill_id]`, so a
 * recent completion that has not been re-assessed yet does not still count as
 * lagging here - the same number the employee's own trajectory shows.
 */
import type { Count, Grade, HrAggregates, NoStepReason } from "../contracts";
import type { Dataset, Employee, RoleProfile } from "../data/load";
import { effectiveSkills } from "./effective";
import { recommend } from "./recommend";

const GRADE_ORDER: Grade[] = ["Junior", "Middle", "Senior", "Lead"];

function toCount(n: number): Count {
  if (n < 1) return n;
  if (n < 5) return { suppressed: true };
  return n;
}

function findProfile(profiles: RoleProfile[], role: string, grade: Grade): RoleProfile | undefined {
  return profiles.find((profile) => profile.role === role && profile.grade === grade);
}

/** Career goal, else next grade in the same role, else hold (own profile again) at Lead. */
function targetProfileFor(emp: Employee, profiles: RoleProfile[]): RoleProfile | undefined {
  if (emp.career_goal) {
    return findProfile(profiles, emp.career_goal.target_role, emp.career_goal.target_grade);
  }
  const idx = GRADE_ORDER.indexOf(emp.grade);
  const nextGrade = idx >= 0 ? GRADE_ORDER[idx + 1] : undefined;
  if (nextGrade) return findProfile(profiles, emp.role, nextGrade);
  return findProfile(profiles, emp.role, emp.grade);
}

function laggingSkills(ds: Dataset): HrAggregates["laggingSkills"] {
  const relevantSkillIds = new Set<string>();
  for (const profile of ds.roleProfiles) {
    for (const skillId of Object.keys(profile.required_skills)) relevantSkillIds.add(skillId);
  }

  const rows = ds.skills
    .filter((skill) => relevantSkillIds.has(skill.skill_id))
    .map((skill) => {
      let belowOwnGrade = 0;
      let belowTarget = 0;
      let criticalBelowTarget = 0;
      for (const emp of ds.employees) {
        const level = effectiveSkills(emp, ds.history, ds.events).effective[skill.skill_id] ?? 0;
        const ownProfile = findProfile(ds.roleProfiles, emp.role, emp.grade);
        const ownRequired = ownProfile?.required_skills[skill.skill_id];
        if (ownRequired !== undefined && level < ownRequired) belowOwnGrade += 1;

        const targetProfile = targetProfileFor(emp, ds.roleProfiles);
        const targetRequired = targetProfile?.required_skills[skill.skill_id];
        if (targetRequired !== undefined && level < targetRequired) {
          belowTarget += 1;
          if (targetProfile?.critical_skills.includes(skill.skill_id)) criticalBelowTarget += 1;
        }
      }
      return {
        skill_id: skill.skill_id,
        name: skill.name,
        belowOwnGrade,
        belowTarget,
        criticalBelowTarget,
        _sort: belowTarget,
      };
    })
    // Most-lagging first; stable tie-break by skill_id so output is deterministic.
    .sort((a, b) => b._sort - a._sort || a.skill_id.localeCompare(b.skill_id));

  return rows.map(({ _sort, ...row }) => ({
    skill_id: row.skill_id,
    name: row.name,
    belowOwnGrade: toCount(row.belowOwnGrade),
    belowTarget: toCount(row.belowTarget),
    criticalBelowTarget: toCount(row.criticalBelowTarget),
  }));
}

function noStepList(ds: Dataset): HrAggregates["noStep"] {
  const rows: { employee_id: string; full_name: string; role: string; grade: Grade; reason: NoStepReason }[] = [];
  for (const emp of ds.employees) {
    const result = recommend(emp.employee_id, ds);
    if (result.noStep) {
      rows.push({
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        role: emp.role,
        grade: emp.grade,
        reason: result.noStep,
      });
    }
  }
  // Never by score: employee_id order only (the build plan T2 acceptance).
  return rows.sort((a, b) => a.employee_id.localeCompare(b.employee_id));
}

function participation(ds: Dataset): HrAggregates["participation"] {
  return ds.events
    .map((event) => {
      const rows = ds.history.filter((row) => row.event_id === event.event_id);
      const byStatusRaw: Record<string, number> = {};
      for (const row of rows) byStatusRaw[row.status] = (byStatusRaw[row.status] ?? 0) + 1;
      const byStatus: Record<string, Count> = {};
      for (const [status, n] of Object.entries(byStatusRaw)) byStatus[status] = toCount(n);
      const completed = byStatusRaw.completed ?? 0;
      const completionRate = rows.length > 0 ? completed / rows.length : null;
      return {
        event_id: event.event_id,
        title: event.title,
        mandatory: event.mandatory,
        byStatus,
        completionRate,
      };
    })
    .sort((a, b) => a.event_id.localeCompare(b.event_id));
}

export function hrAggregates(ds: Dataset): HrAggregates {
  return {
    n: ds.employees.length,
    laggingSkills: laggingSkills(ds),
    noStep: noStepList(ds),
    participation: participation(ds),
  };
}
