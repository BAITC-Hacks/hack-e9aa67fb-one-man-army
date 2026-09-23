/**
 * HR individual-access audit (docs/threat-model.md T5).
 *
 * An HR session reading one employee's profile is a privileged read of
 * personal development data, so it is audited with actor, subject and
 * purpose. Audit-write failure denies the view: if the event cannot be
 * recorded, the caller must not render the data (fail closed).
 */
import { recordAudit, type AuditEvent } from "./audit";

export type HrViewChannel = "page" | "api";

/**
 * Records the view. Returns the event on success, or null when the audit
 * write failed - callers treat null as "deny". Never throws.
 */
export async function auditHrProfileView(
  employeeId: string,
  channel: HrViewChannel,
): Promise<AuditEvent | null> {
  try {
    return await recordAudit({
      actor: { id: "HR01", role: "hr", label: "HR" },
      action: "employee.profile_view",
      subject: { type: "employee", id: employeeId },
      outcome: "allowed",
      reason: `Purpose: development support. HR viewed the profile of employee ${employeeId} via ${channel}.`,
      evidence: [],
    });
  } catch {
    // No detail logged: the error may carry the store path. The denial itself is the signal.
    console.error("[audit] HR profile-view audit write failed; view denied");
    return null;
  }
}

/**
 * Records an HR session viewing the aggregate analytics view (docs/threat-model.md
 * T5). Unlike `auditHrProfileView`, this throws on audit-write failure rather
 * than returning null: callers (the aggregates route) must let the throw
 * propagate and deny the view (fail closed), same denial outcome, different
 * mechanics because the caller here is a route, not a page render.
 */
export async function auditHrAggregatesView(actorId: string): Promise<void> {
  await recordAudit({
    actor: { id: actorId, role: "hr", label: "HR" },
    action: "hr.aggregates.view",
    subject: { type: "hr-aggregates", id: "hr-aggregates" },
    outcome: "allowed",
    reason: `Purpose: workforce analytics. HR (${actorId}) viewed aggregate development analytics.`,
    evidence: [],
  });
}
