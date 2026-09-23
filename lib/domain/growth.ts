/**
 * The only place the skill-growth formula exists (docs/architecture.md §1).
 */
export function applyGrowth(level: number, gain: number, max: number): number {
  return Math.max(level, Math.min(level + gain, max));
}
