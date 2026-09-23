/**
 * Filled in by T2. See docs/architecture.md §1: completeEvent(empId, eventId,
 * actor) -> ProgressResult.
 *
 * Growth formula is inlined here (not imported from `lib/domain/growth.ts`,
 * which is T1's file and did not exist yet when this was written): the same
 * `max(level, min(level + gain, max_level))` documented in architecture.md.
 * "Before" / "after" levels use the employee's stored `skills[skill_id]`
 * rather than the full pending-gain "effective" calculation (T1's
 * `effective.ts`), which is the documented Batch-1 simplification for T2.
 */
import type { ProgressResult } from "../contracts";
import { recordAudit } from "../audit/audit";
import { appendJsonl } from "../store/jsonl";
import { getDataset, invalidateDataset } from "../data/load";
import type { Employee } from "../data/load";
import { trajectory } from "./trajectory";
import { recommend } from "./recommend";

export interface ProgressActor {
  role: "employee" | "hr";
  id: string;
}

/** Thrown for the cases the route layer maps to an HTTP error (architecture.md §4). */
export class ProgressError extends Error {
  constructor(
    readonly code: "EMPLOYEE_NOT_FOUND" | "NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "ProgressError";
  }
}

/** `max(level, min(level + gain, max_level))` - the only place this formula exists in T2's files. */
export function applyGrowth(level: number, gain: number, max: number): number {
  return Math.max(level, Math.min(level + gain, max));
}

function findEmployee(employees: Employee[], empId: string): Employee | undefined {
  return employees.find((employee) => employee.employee_id === empId);
}

export async function completeEvent(
  empId: string,
  eventId: string,
  actor: ProgressActor,
): Promise<ProgressResult> {
  const dsBefore = await getDataset();
  const empBefore = findEmployee(dsBefore.employees, empId);
  if (!empBefore) {
    throw new ProgressError("EMPLOYEE_NOT_FOUND", `Unknown employee ${empId}`);
  }

  const event = dsBefore.events.find((candidate) => candidate.event_id === eventId);
  if (!event) {
    throw new ProgressError("NOT_ELIGIBLE", `Unknown event ${eventId}`);
  }
  if (event.mandatory) {
    throw new ProgressError("NOT_ELIGIBLE", `${eventId} is mandatory, not a self-completion`);
  }
  const alreadyCompleted = dsBefore.history.some(
    (row) => row.employee_id === empId && row.event_id === eventId && row.status === "completed",
  );
  if (alreadyCompleted) {
    throw new ProgressError("NOT_ELIGIBLE", `${eventId} is already completed for ${empId}`);
  }

  const trajectoryBefore = trajectory(empBefore, dsBefore);

  const changes = event.develops_skills.map((entry) => {
    const before = empBefore.skills[entry.skill_id] ?? 0;
    const after = applyGrowth(before, entry.gain, entry.max_level);
    return {
      skill_id: entry.skill_id,
      before,
      after,
      gain: entry.gain,
      max_level: entry.max_level,
      capped: before + entry.gain > entry.max_level,
    };
  });

  const recordId = `completion_${crypto.randomUUID()}`;
  await appendJsonl("completions.jsonl", {
    record_id: recordId,
    employee_id: empId,
    event_id: eventId,
    date: dsBefore.asOfDate,
    status: "completed",
    completion_pct: 100,
    assigned_by: actor.role === "hr" ? "hr" : "self",
  });
  invalidateDataset();

  const dsAfter = await getDataset();
  const empAfter = findEmployee(dsAfter.employees, empId) ?? empBefore;
  const trajectoryAfter = trajectory(empAfter, dsAfter);
  const recommendations = recommend(empId, dsAfter);

  await recordAudit({
    actor: {
      id: actor.id,
      role: actor.role === "hr" ? "officer" : "citizen",
      label: actor.role === "hr" ? "HR specialist" : `Employee ${actor.id}`,
    },
    action: "progress.event-completed",
    subject: { type: "event", id: eventId },
    outcome: "completed",
    reason: `${actor.role} marked ${eventId} completed for ${empId}`,
    evidence: [recordId],
  });

  return {
    event_id: eventId,
    changes,
    trajectoryBefore,
    trajectoryAfter,
    recommendations,
  };
}
