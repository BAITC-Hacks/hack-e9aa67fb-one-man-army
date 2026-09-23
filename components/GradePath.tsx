/**
 * Grade-transition path (O-01): the deterministic, ordered plan of catalogue
 * events that would close every gap toward the next grade - critical gaps
 * first. Presented as a voluntary plan (no countdowns, no pressure wording,
 * no comparison to colleagues), and honest about gaps nothing yet closes.
 */
import type { GradePathResult } from "@/lib/domain/gradePath";
import type { Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";

export function GradePath({ path, locale }: { path: GradePathResult; locale: Locale }) {
  const grade = path.target.grade;

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
                  {step.closes.map((c) => `${c.skill_id} ${c.from} → ${c.to}`).join(", ")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {path.unresolvedGaps.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "gradePath.unresolvedTitle")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
            {path.unresolvedGaps.map((gap) => (
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
