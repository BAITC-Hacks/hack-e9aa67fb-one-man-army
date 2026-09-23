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
      actor: { id: "HR01", role: "officer", label: "HR" },
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
