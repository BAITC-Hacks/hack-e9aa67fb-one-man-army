/**
 * Grade-transition path (O-01): the deterministic, ordered plan of catalogue
 * events that would close every gap toward the next grade - critical gaps
 * first. Presented as a voluntary plan (no countdowns, no pressure wording,
 * no comparison to colleagues), and honest about gaps nothing yet closes.
 */
import type { GradePathResult } from "@/lib/domain/gradePath";
import type { Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";

export function GradePath({
  path,
  locale,
  skillNames,
}: {
  path: GradePathResult;
  locale: Locale;
  /** skill_id -> display name, so the panel never shows a raw catalogue id. */
  skillNames: Record<string, string>;
}) {
  const grade = path.target.grade;
  const nameOf = (skillId: string) => skillNames[skillId] ?? skillId;

  // Honest split: a gap a step partly closed (projected level rose above the
  // baseline effective level, even if still short of the requirement) is
  // "still open after these steps", not "nothing closes this" - the earlier
  // version conflated the two and misrepresented steps that did help.
  const stillOpen = path.unresolvedGaps.filter((g) => (path.projectedLevels[g.skill_id] ?? g.effective) > g.effective);
  const noActivity = path.unresolvedGaps.filter(
    (g) => (path.projectedLevels[g.skill_id] ?? g.effective) <= g.effective,
  );

  return (
    <section aria-labelledby="grade-path-heading">
      <h2 id="grade-path-heading" className="text-base font-semibold text-[var(--color-ink)]">
        {tf(locale, "gradePath.title", { grade })}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "gradePath.subtitle")}</p>

      {path.target.held ? (
        <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <p className="font-medium text-[var(--color-ink)]">{tf(locale, "gradePath.held.title", { grade })}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{tf(locale, "gradePath.held.body", { grade })}</p>
        </div>
      ) : null}

      <div className="mt-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          {tf(locale, "gradePath.gapsTitle", { grade })}
        </h3>
        {path.gaps.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{tf(locale, "gradePath.gaps.empty", { grade })}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
            {path.gaps.map((gap) => (
              <li key={gap.skill_id}>
                {gap.name}: {gap.effective} → {gap.required}
                {gap.critical && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                    {t(locale, "gradePath.critical")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "gradePath.stepsTitle")}</h3>
        {path.steps.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{tf(locale, "gradePath.steps.empty", { grade })}</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {path.steps.map((step, index) => (
              <li
                key={step.event_id}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm"
              >
                <p className="font-medium text-[var(--color-ink)]">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-1 text-[var(--color-muted)]">
                  {t(locale, "gradePath.stepMoves")}:{" "}
                  {step.closes.map((c) => `${nameOf(c.skill_id)} ${c.from} → ${c.to}`).join(", ")}
                </p>
                {step.note?.kind === "previously_skipped" && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {tf(locale, "gradePath.stepPreviouslySkipped", { n: String(step.note.count) })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {stillOpen.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "gradePath.stillOpenTitle")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
            {stillOpen.map((gap) => {
              const projected = path.projectedLevels[gap.skill_id] ?? gap.effective;
              return (
                <li key={gap.skill_id}>
                  {gap.name}
                  {gap.critical && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                      {t(locale, "gradePath.critical")}
                    </span>
                  )}
                  <span className="block text-xs text-[var(--color-muted)]">
                    {tf(locale, "gradePath.stillOpenRow", { projected, required: gap.required })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {noActivity.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "gradePath.unresolvedTitle")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
            {noActivity.map((gap) => (
              <li key={gap.skill_id}>
                {gap.name}
                {gap.critical && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                    {t(locale, "gradePath.critical")}
                  </span>
                )}
                <span className="block text-xs text-[var(--color-muted)]">
                  {t(locale, "gradePath.unresolvedBody")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
