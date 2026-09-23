/** Last review -> current -> required skill gap table. Pure presentation. */
import type { GapRow } from "@/lib/contracts";
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";
import { Pill } from "./Pill";

export function GapTable({ rows, locale, title }: { rows: GapRow[]; locale: Locale; title: string }) {
  if (rows.length === 0) {
    return (
      <section aria-labelledby="gaps-heading">
        <h2 id="gaps-heading" className="text-base font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{t(locale, "gaps.empty")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="gaps-heading">
      <h2 id="gaps-heading" className="text-base font-semibold text-[var(--color-ink)]">
        {title}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t(locale, "gaps.skill")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(locale, "gaps.assessed")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(locale, "gaps.effective")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(locale, "gaps.required")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t(locale, "gaps.gap")}
              </th>
              <th scope="col" className="py-2 pl-3 font-medium">
                {t(locale, "gaps.critical")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.skill_id} className="border-b border-[var(--color-line)] last:border-0">
                <td className="py-2 pr-3 text-[var(--color-ink)]">
                  {row.name}
                  {row.pendingFrom.length > 0 && (
                    <span className="block text-xs text-[var(--color-muted)]">
                      {t(locale, "gaps.pendingFrom")}{" "}
                      {row.pendingFrom.map((p) => p.event_id).join(", ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.assessed}</td>
                <td className="px-3 py-2 tabular-nums">{row.effective}</td>
                <td className="px-3 py-2 tabular-nums">{row.required}</td>
                <td className="px-3 py-2 tabular-nums">{row.gap}</td>
                <td className="py-2 pl-3">
                  {row.critical ? (
                    <Pill tone="critical">{t(locale, "gaps.criticalYes")}</Pill>
                  ) : (
                    <Pill tone="regular">{t(locale, "gaps.regular")}</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
