/**
 * Eligibility rules (docs/architecture.md §1, docs/requirements.md I-01..I-05).
 * Evaluated per (employee, event) through `evaluateRules` (lib/rules/engine.ts),
 * in this fixed order, so every recommendation carries a trace.
 */
import type { Rule } from "../rules/engine";
import type { Dataset, Employee, Event, HistoryRow } from "../data/load";

export interface EligFacts {
  employee: Employee;
  event: Event;
  ds: Dataset;
  effective: Record<string, number>;
  history: HistoryRow[];
  dismissedEventIds: string[];
}

function usefulGainAny(event: Event, effective: Record<string, number>): boolean {
  return event.develops_skills.some((d) => (effective[d.skill_id] ?? 0) < d.max_level);
}

export const eligibilityRules: Rule<EligFacts>[] = [
  {
    id: "not-mandatory",
    description: "Mandatory events are assigned by HR, never a recommendation target.",
    evaluate: ({ facts }) =>
      facts.event.mandatory ? { status: "fail", detail: "mandatory: assigned by HR, not a recommendation target" } : { status: "pass" },
  },
  {
    id: "audience-role",
    description: "The event must target the employee's current role.",
    evaluate: ({ facts }) =>
      facts.event.target_roles.includes(facts.employee.role)
        ? { status: "pass" }
        : { status: "fail", detail: `role ${facts.employee.role} is not in target_roles` },
  },
  {
    id: "audience-grade",
    description: "The event must target the employee's current grade.",
    evaluate: ({ facts }) =>
      facts.event.target_grades.includes(facts.employee.grade)
        ? { status: "pass" }
        : { status: "fail", detail: `grade ${facts.employee.grade} is not in target_grades` },
  },
  {
    id: "prereqs-met",
    description: "Every prerequisite skill must be at or above the required effective level.",
    evaluate: ({ facts }) => {
      for (const [skillId, min] of Object.entries(facts.event.prerequisites)) {
        const have = facts.effective[skillId] ?? 0;
        if (have < min) return { status: "fail", detail: `prerequisite ${skillId} needs ${min}, has ${have}` };
      }
      return { status: "pass" };
    },
  },
  {
    id: "not-completed",
    description: "No repeats, except EV_036 (recurring club).",
    evaluate: ({ facts }) => {
      if (facts.event.event_id === "EV_036") return { status: "not-applicable", detail: "EV_036 is exempt (recurring)" };
      const completed = facts.history.some(
        (row) => row.employee_id === facts.employee.employee_id && row.event_id === facts.event.event_id && row.status === "completed",
      );
      return completed ? { status: "fail", detail: "already completed" } : { status: "pass" };
    },
  },
  {
    id: "not-in-progress",
    description: "An event already underway is offered as 'continue', not recommended again.",
    evaluate: ({ facts }) => {
      const inProgress = facts.history.some(
        (row) => row.employee_id === facts.employee.employee_id && row.event_id === facts.event.event_id && row.status === "in_progress",
      );
      return inProgress ? { status: "fail", detail: "already in progress" } : { status: "pass" };
    },
  },
  {
    id: "has-session",
    description: "Self-paced is always available; other formats need an upcoming session.",
    evaluate: ({ facts }) => {
      if (facts.event.format === "self_paced") return { status: "pass" };
      const hasFuture = facts.event.upcoming_sessions.some((d) => d >= facts.ds.asOfDate);
      return hasFuture ? { status: "pass" } : { status: "fail", detail: "no upcoming session" };
    },
  },
  {
    id: "useful-gain",
    description: "The event must still be able to raise at least one developed skill.",
    evaluate: ({ facts }) =>
      usefulGainAny(facts.event, facts.effective) ? { status: "pass" } : { status: "fail", detail: "no useful gain left on any developed skill" },
  },
  {
    id: "not-dismissed",
    description: "The employee has not dismissed this event ('not useful for me').",
    evaluate: ({ facts }) =>
      facts.dismissedEventIds.includes(facts.event.event_id) ? { status: "fail", detail: "dismissed by employee" } : { status: "pass" },
  },
];
