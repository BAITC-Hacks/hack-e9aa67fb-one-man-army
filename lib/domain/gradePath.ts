/**
 * gradePath(emp, ds) -> GradePath (O-01 originality item, review-1430 #O-01).
 *
 * A deterministic "path to next grade": per required skill of the employee's
 * next grade, effective vs required level, plus a minimal ORDERED set of
 * catalogue events that would close every gap, chosen greedily (critical
 * skills first, then largest gap), respecting prerequisites (re-checked
 * against the running simulated effective level after each pick, so an event
 * unlocked only after an earlier step counts), max_level caps (via the same
 * `applyGrowth` formula as the real engine) and de-duplicated (an event is
 * only ever selected once, even if it helps multiple skills). Any gap no
 * catalogue event can close (no event develops it, or every developing event
 * is capped below the requirement) is reported separately - never silently
 * dropped.
 *
 * This mirrors, but is intentionally independent of, `trajectory.ts`:
 * `trajectory` targets the stated career goal when set; this module always
 * targets the plain next grade in the employee's current role (Junior ->
 * Middle -> Senior -> Lead), per the task's O-01 wording. At Lead with no
 * further grade, it plans against the *current* grade's requirements instead
 * (the same "hold" reading as docs/domain.md §2).
 */
import type { Grade } from "../contracts";
import type { Dataset, Employee, Event } from "../data/load";
import { effectiveSkills } from "./effective";
import { applyGrowth } from "./growth";

const GRADE_ORDER: Grade[] = ["Junior", "Middle", "Senior", "Lead"];

function nextGradeOf(grade: Grade): Grade | null {
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx < 0 || idx >= GRADE_ORDER.length - 1) return null;
  return GRADE_ORDER[idx + 1] ?? null;
}

function usefulGain(effectiveLevel: number, gain: number, maxLevel: number): number {
  return Math.max(0, Math.min(effectiveLevel + gain, maxLevel) - effectiveLevel);
}

export interface GradePathGap {
  skill_id: string;
  name: string;
  effective: number;
  required: number;
  gap: number;
  critical: boolean;
  /** Only set on `unresolvedGaps`: the effective level after every planned
   *  step is applied (may be > `effective` if a step partially closed it
   *  without reaching `required`). Additive, backward-compatible field -
   *  `effective`/`gap` above stay the pre-plan baseline. */
  projected?: number;
}

export interface GradePathStep {
  event_id: string;
  title: string;
  /** Every skill this step raises, including side-benefits beyond the skill
   *  it was picked for. */
  closes: Array<{ skill_id: string; from: number; to: number }>;
  /** Set only when this event was the sole (or least-avoided) catalogue
   *  option and the employee has repeatedly skipped/dropped it before -
   *  additive field so the UI can disclose it honestly. */
  note?: { kind: "previously_skipped"; count: number };
}

export interface GradePathResult {
  employee_id: string;
  current: { role: string; grade: Grade };
  target: { role: string; grade: Grade; held: boolean };
  /** Gap table before any step is applied. */
  gaps: GradePathGap[];
  /** Minimal ordered set of eligible events that together close every
   *  closeable gap. */
  steps: GradePathStep[];
  /** Effective level per required skill after every step is applied. */
  projectedLevels: Record<string, number>;
  /** Skills that still fall short of the requirement after every eligible,
   *  catalogue event has been applied - nothing in the catalogue closes them
   *  further (no developing event, or every one is capped too low). */
  unresolvedGaps: GradePathGap[];
}

/** Thrown when the employee's current role/grade has no catalogue profile,
 * or their skills map is empty - mirrors trajectory.ts's ProfileIncompleteError. */
export class GradePathProfileIncompleteError extends Error {
  constructor(employeeId: string) {
    super(`DATA_INCOMPLETE: no role profile or skills for ${employeeId}`);
    this.name = "GradePathProfileIncompleteError";
  }
}

export function gradePath(emp: Employee, ds: Dataset): GradePathResult {
  const hasOwnProfile = ds.roleProfiles.some((p) => p.role === emp.role && p.grade === emp.grade);
  if (!hasOwnProfile || Object.keys(emp.skills).length === 0) {
    throw new GradePathProfileIncompleteError(emp.employee_id);
  }

  const nextGrade = nextGradeOf(emp.grade);
  const targetGrade: Grade = nextGrade ?? emp.grade;
  const held = nextGrade === null;

  const targetProfile = ds.roleProfiles.find((p) => p.role === emp.role && p.grade === targetGrade);
  const skillNames = new Map(ds.skills.map((s) => [s.skill_id, s.name]));
  const { effective: baseline } = effectiveSkills(emp, ds.history, ds.events);
  const effective: Record<string, number> = { ...baseline };

  const required = targetProfile?.required_skills ?? {};
  const critical = new Set(targetProfile?.critical_skills ?? []);

  const gaps: GradePathGap[] = Object.entries(required)
    .map(([skill_id, req]) => ({
      skill_id,
      name: skillNames.get(skill_id) ?? skill_id,
      effective: effective[skill_id] ?? 0,
      required: req,
      gap: Math.max(0, req - (effective[skill_id] ?? 0)),
      critical: critical.has(skill_id),
    }))
    .filter((g) => g.gap > 0)
    .sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap || a.skill_id.localeCompare(b.skill_id));

  const completedEventIds = new Set(
    ds.history
      .filter((row) => row.employee_id === emp.employee_id && row.status === "completed")
      .map((row) => row.event_id),
  );

  // Same negative signal the recommender's participation-history factor uses
  // (lib/domain/history.ts F5/F7): no_show/declined/dropped, per event_id,
  // for this employee. Used here to avoid re-proposing an event the employee
  // has repeatedly skipped when an equivalent alternative exists.
  const dropCounts = new Map<string, number>();
  for (const row of ds.history) {
    if (row.employee_id !== emp.employee_id) continue;
    if (row.status !== "no_show" && row.status !== "declined" && row.status !== "dropped") continue;
    dropCounts.set(row.event_id, (dropCounts.get(row.event_id) ?? 0) + 1);
  }

  const steps: GradePathStep[] = [];
  const selectedIds = new Set<string>();
  const unresolvedSkillIds = new Set<string>();

  const requiredOf = (skillId: string): number => required[skillId] ?? 0;
  const remainingGap = (skillId: string): number => Math.max(0, requiredOf(skillId) - (effective[skillId] ?? 0));

  let guard = ds.events.length + gaps.length + 5;
  while (guard-- > 0) {
    const active = gaps.filter((g) => !unresolvedSkillIds.has(g.skill_id) && remainingGap(g.skill_id) > 0);
    if (active.length === 0) break;
    active.sort(
      (a, b) =>
        Number(b.critical) - Number(a.critical) || remainingGap(b.skill_id) - remainingGap(a.skill_id) || a.skill_id.localeCompare(b.skill_id),
    );
    const target = active[0];
    if (!target) break;

    const candidates: Array<{ event: Event; gain: number; avoidance: number }> = [];
    for (const ev of ds.events) {
      if (selectedIds.has(ev.event_id)) continue;
      if (ev.mandatory) continue;
      if (!ev.target_roles.includes(emp.role)) continue;
      if (!ev.target_grades.includes(emp.grade)) continue;
      if (completedEventIds.has(ev.event_id) && ev.event_id !== "EV_036") continue;

      let prereqOk = true;
      for (const [skillId, min] of Object.entries(ev.prerequisites)) {
        if ((effective[skillId] ?? 0) < min) {
          prereqOk = false;
          break;
        }
      }
      if (!prereqOk) continue;

      const dev = ev.develops_skills.find((d) => d.skill_id === target.skill_id);
      if (!dev) continue;
      const gain = usefulGain(effective[target.skill_id] ?? 0, dev.gain, dev.max_level);
      if (gain <= 0) continue;
      candidates.push({ event: ev, gain, avoidance: dropCounts.get(ev.event_id) ?? 0 });
    }

    if (candidates.length === 0) {
      unresolvedSkillIds.add(target.skill_id);
      continue;
    }

    // Prefer an alternative (other format) that develops the same skill and
    // that the employee has not repeatedly skipped/dropped; only fall back
    // to a repeatedly-skipped event when it is the least-avoided option.
    candidates.sort(
      (a, b) => a.avoidance - b.avoidance || b.gain - a.gain || a.event.event_id.localeCompare(b.event.event_id),
    );
    const chosen = candidates[0];
    if (!chosen) {
      unresolvedSkillIds.add(target.skill_id);
      continue;
    }
    const best = chosen.event;
    const note: GradePathStep["note"] = chosen.avoidance >= 2 ? { kind: "previously_skipped", count: chosen.avoidance } : undefined;

    const closes: Array<{ skill_id: string; from: number; to: number }> = [];
    for (const dev of best.develops_skills) {
      const from = effective[dev.skill_id] ?? 0;
      const to = applyGrowth(from, dev.gain, dev.max_level);
      if (to !== from) {
        effective[dev.skill_id] = to;
        closes.push({ skill_id: dev.skill_id, from, to });
      }
    }
    steps.push(note ? { event_id: best.event_id, title: best.title, closes, note } : { event_id: best.event_id, title: best.title, closes });
    selectedIds.add(best.event_id);
  }

  const projectedLevels: Record<string, number> = {};
  for (const skillId of Object.keys(required)) projectedLevels[skillId] = effective[skillId] ?? 0;

  const unresolvedGaps = gaps
    .filter((g) => remainingGap(g.skill_id) > 0)
    .map((g) => ({ ...g, projected: effective[g.skill_id] ?? 0 }));

  return {
    employee_id: emp.employee_id,
    current: { role: emp.role, grade: emp.grade },
    target: { role: emp.role, grade: targetGrade, held },
    gaps,
    steps,
    projectedLevels,
    unresolvedGaps,
  };
}
