/**
 * Append-only audit trail for consequential actions.
 *
 * The product must be able to answer "who did what, on whose authority,
 * and on what evidence". Any state change an employee or HR can feel should
 * emit one of these events. The log is append-only by construction: there is no
 * update or delete API.
 */
import { z } from "zod";
import { appendJsonl, readJsonl } from "../store/jsonl";

export const AuditActor = z.object({
  /** Stable pseudonymous id. Never a raw national ID number. */
  id: z.string().min(1),
  role: z.enum(["employee", "hr", "system", "ai-agent"]),
  /** Display label safe to show in a UI and safe to log. */
  label: z.string().min(1),
});
export type AuditActor = z.infer<typeof AuditActor>;

export const AuditEvent = z.object({
  id: z.string().min(1),
  at: z.string().datetime(),
  actor: AuditActor,
  /** Dotted verb, e.g. "appeal.classified", "benefit.decided". */
  action: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
  /** What the action was performed on. */
  subject: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  outcome: z.enum(["allowed", "denied", "escalated", "completed", "failed"]),
  /** Human-readable justification. Shown to auditors, so no chain-of-thought. */
  reason: z.string().min(1),
  /** Ids of evidence records the decision rested on. */
  evidence: z.array(z.string()).default([]),
  /** Set when a model influenced the action, so AI involvement is never hidden. */
  ai: z
    .object({ modelRef: z.string(), deterministic: z.boolean() })
    .optional(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

const AUDIT_LOG = "audit.jsonl";

/** Fields callers supply; id and timestamp are assigned here. */
export type AuditDraft = Omit<AuditEvent, "id" | "at">;

export async function recordAudit(draft: AuditDraft): Promise<AuditEvent> {
  const event = AuditEvent.parse({
    ...draft,
    id: `aud_${crypto.randomUUID()}`,
    at: new Date().toISOString(),
  });
  await appendJsonl(AUDIT_LOG, event);
  return event;
}

export async function readAuditTrail(subjectId?: string): Promise<AuditEvent[]> {
  const rows = await readJsonl<AuditEvent>(AUDIT_LOG);
  return subjectId ? rows.filter((row) => row.subject.id === subjectId) : rows;
}
