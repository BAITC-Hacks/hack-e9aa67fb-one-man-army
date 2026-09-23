/** One summary number on the HR overview. `value` is pre-formatted so the caller decides "not available" vs a number. */
export function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
