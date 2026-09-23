/** Readiness bar: a plain-language percentage, never colour alone (label carries the number). */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-2 h-2.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-line)]"
      >
        <div
          className="h-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
