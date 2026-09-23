/**
 * Participation-history signal (I-08, domain.md §3 F5/F7): per employee x
 * (candidate event and "similar" events - shared developed skill, or same
 * type+format), within a 12-month recency window. `no_show` / `declined` /
 * `dropped` are negative; `completed` (self-enrolled) is positive. A
 * manager/HR-imposed `declined` is a weaker signal than a self-enrolled
 * no-show (domain.md: recommend x0.5).
 */
import type { Dataset, Event } from "../data/load";

export interface Engagement {
  /** Weighted count of negative records on similar events (12mo window). */
  negativeCount: number;
  /** Count of on-time, self-enrolled completions on similar events. */
  positiveOnTime: number;
  /** format -> negative weight, so scoring can favour a different format. */
  negativeByFormat: Record<string, number>;
}

const RECENCY_MONTHS = 12;

function monthsBetween(asOf: string, date: string): number {
  const a = new Date(asOf);
  const d = new Date(date);
  if (Number.isNaN(a.getTime()) || Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return (a.getFullYear() - d.getFullYear()) * 12 + (a.getMonth() - d.getMonth());
}

function sharesSkill(a: Event, b: Event): boolean {
  const skillsA = new Set(a.develops_skills.map((s) => s.skill_id));
  return b.develops_skills.some((s) => skillsA.has(s.skill_id));
}

export function engagement(empId: string, candidate: Event, ds: Dataset): Engagement {
  const eventsById = new Map(ds.events.map((e) => [e.event_id, e]));
  let negativeCount = 0;
  let positiveOnTime = 0;
  const negativeByFormat: Record<string, number> = {};

  for (const row of ds.history) {
    if (row.employee_id !== empId) continue;
    const ev = eventsById.get(row.event_id);
    if (!ev) continue;
    const similar =
      ev.event_id === candidate.event_id ||
      sharesSkill(ev, candidate) ||
      (ev.type === candidate.type && ev.format === candidate.format);
    if (!similar) continue;
    const age = monthsBetween(ds.asOfDate, row.date);
    if (age > RECENCY_MONTHS) continue;

    if (row.status === "no_show" || row.status === "declined" || row.status === "dropped") {
      const weight = row.status === "declined" && (row.assigned_by === "manager" || row.assigned_by === "hr") ? 0.5 : 1;
      negativeCount += weight;
      negativeByFormat[ev.format] = (negativeByFormat[ev.format] ?? 0) + weight;
    } else if (row.status === "completed" && row.assigned_by === "self") {
      positiveOnTime += 1;
    }
  }

  return { negativeCount, positiveOnTime, negativeByFormat };
}
