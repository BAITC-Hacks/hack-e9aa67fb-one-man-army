/**
 * completedActivities(emp, ds) -> read-only list of this employee's completed
 * history rows (status "completed"), newest first, joined with the event's
 * title/type/format and the skills it develops (names resolved, "+gain"
 * shown per skill). Pure presentation mapping - no authz here; callers must
 * only pass a Dataset already scoped to an authorised request (the employee
 * page's existing `getDataset()` read).
 */
import type { Dataset, Employee } from "../data/load";

export interface CompletedActivitySkill {
  skill_id: string;
  name: string;
  gain: number;
}

export interface CompletedActivity {
  record_id: string;
  event_id: string;
  title: string;
  type: string;
  format: string;
  date: string;
  skills: CompletedActivitySkill[];
}

export function completedActivities(emp: Employee, ds: Dataset): CompletedActivity[] {
  const eventsById = new Map(ds.events.map((e) => [e.event_id, e]));
  const skillNames = new Map(ds.skills.map((s) => [s.skill_id, s.name]));

  return ds.history
    .filter((row) => row.employee_id === emp.employee_id && row.status === "completed")
    .map((row) => {
      const event = eventsById.get(row.event_id);
      return {
        record_id: row.record_id,
        event_id: row.event_id,
        title: event?.title ?? row.event_id,
        type: event?.type ?? "",
        format: event?.format ?? "",
        date: row.date,
        skills: (event?.develops_skills ?? []).map((s) => ({
          skill_id: s.skill_id,
          name: skillNames.get(s.skill_id) ?? s.skill_id,
          gain: s.gain,
        })),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.record_id < b.record_id ? 1 : -1));
}
