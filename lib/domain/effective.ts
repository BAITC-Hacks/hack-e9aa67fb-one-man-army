/**
 * Effective skill levels (I-06): assessed level + gains from `completed`
 * events dated strictly after `last_review_date`, applied in date order with
 * `applyGrowth`. Stale assessments are a documented trap (docs/requirements.md
 * I-06): 202 such completions exist in the base data, so this is the common
 * case, not an edge case.
 */
import type { Dataset, Employee, HistoryRow, Event } from "../data/load";
import { applyGrowth } from "./growth";

export interface PendingGain {
  event_id: string;
  date: string;
  skill_id: string;
  from: number;
  to: number;
}

export interface EffectiveSkills {
  assessed: Record<string, number>;
  effective: Record<string, number>;
  pending: PendingGain[];
}

export function effectiveSkills(
  emp: Employee,
  history: HistoryRow[],
  events: Event[],
): EffectiveSkills {
  const assessed: Record<string, number> = { ...emp.skills };
  const effective: Record<string, number> = { ...emp.skills };
  const pending: PendingGain[] = [];
  const eventsById = new Map(events.map((e) => [e.event_id, e]));

  const rows = history
    .filter(
      (row) =>
        row.employee_id === emp.employee_id &&
        row.status === "completed" &&
        row.date > emp.last_review_date,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.record_id.localeCompare(b.record_id));

  for (const row of rows) {
    const event = eventsById.get(row.event_id);
    if (!event) continue;
    for (const dev of event.develops_skills) {
      const before = effective[dev.skill_id] ?? 0;
      const after = applyGrowth(before, dev.gain, dev.max_level);
      if (after !== before) {
        effective[dev.skill_id] = after;
        pending.push({ event_id: event.event_id, date: row.date, skill_id: dev.skill_id, from: before, to: after });
      }
    }
  }

  return { assessed, effective, pending };
}

/** True when the employee's role/grade is not a known role profile, or their
 * skills map is empty - the DATA_INCOMPLETE case (I-07 table). The engine
 * never guesses from a partial profile. */
export function isProfileIncomplete(emp: Employee, ds: Dataset): boolean {
  const hasProfile = ds.roleProfiles.some((p) => p.role === emp.role && p.grade === emp.grade);
  return !hasProfile || Object.keys(emp.skills).length === 0;
}
