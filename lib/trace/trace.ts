/**
 * Operational trace of an agent run.
 *
 * This is what the demo shows and what an auditor reads: the steps the system
 * took, the evidence it used, and the deterministic decision it reached.
 * It deliberately carries no chain-of-thought - only observable operations.
 */

export type TraceStepKind =
  | "intent"
  | "retrieval"
  | "tool-request"
  | "validation"
  | "authorization"
  | "rule"
  | "action"
  | "escalation"
  | "response";

export interface TraceStep {
  kind: TraceStepKind;
  label: string;
  /** Small, display-safe payload. Never raw prompts or personal data. */
  detail?: Record<string, unknown>;
  at: string;
  durationMs?: number;
}

export class Trace {
  readonly id = `trc_${crypto.randomUUID()}`;
  readonly startedAt = Date.now();
  private readonly steps: TraceStep[] = [];

  step(kind: TraceStepKind, label: string, detail?: Record<string, unknown>): void {
    this.steps.push({
      kind,
      label,
      detail,
      at: new Date().toISOString(),
      durationMs: Date.now() - this.startedAt,
    });
  }

  /** Wraps an async operation, recording it whether it succeeds or fails. */
  async track<T>(
    kind: TraceStepKind,
    label: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      const value = await operation();
      this.step(kind, label, { ok: true });
      return value;
    } catch (error) {
      this.step(kind, label, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  toJSON(): { id: string; totalMs: number; steps: TraceStep[] } {
    return {
      id: this.id,
      totalMs: Date.now() - this.startedAt,
      steps: [...this.steps],
    };
  }
}
