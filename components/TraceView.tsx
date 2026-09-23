/**
 * "Why this step": the factor score breakdown and the eligibility rule
 * trace behind one recommendation. This is the evidence panel - it shows
 * what the engine understood and which rule fired, not just a score.
 */
import type { Factor, RuleTraceEntry } from "@/lib/contracts";
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";

const STATUS_STYLE: Record<RuleTraceEntry["status"], string> = {
  pass: "text-emerald-700",
  fail: "text-red-700",
  undetermined: "text-amber-700",
  "not-applicable": "text-[var(--color-muted)]",
};

export function TraceView({
  factors,
  rules,
  score,
  scoringVersion,
  locale,
}: {
  factors: Factor[];
  rules: RuleTraceEntry[];
  score: number;
  scoringVersion: string;
  locale: Locale;
}) {
  return (
    <div className="mt-3 space-y-4 border-t border-[var(--color-line)] pt-3">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "recs.factorsTitle")}</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  {t(locale, "recs.factor.kind")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {t(locale, "recs.factor.weight")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {t(locale, "recs.factor.raw")}
                </th>
                <th scope="col" className="py-1.5 pl-3 font-medium">
                  {t(locale, "recs.factor.contribution")}
                </th>
              </tr>
            </thead>
            <tbody>
              {factors.map((factor) => (
                <tr key={factor.code} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="py-1.5 pr-3 text-[var(--color-ink)]">
                    {t(locale, `factor.kind.${factor.kind}`)}
                    <span className="ml-1 text-xs text-[var(--color-muted)]">({factor.code})</span>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{factor.weight}</td>
                  <td className="px-3 py-1.5 tabular-nums">{factor.raw}</td>
                  <td className="py-1.5 pl-3 tabular-nums">{factor.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {t(locale, "recs.score")}: <span className="tabular-nums font-medium">{score}</span> ·{" "}
          {t(locale, "recs.scoringVersion")}: {scoringVersion}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "recs.rulesTitle")}</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {rules.map((rule) => (
            <li key={rule.ruleId} className="flex flex-wrap items-baseline gap-x-2">
              <span className={`font-medium ${STATUS_STYLE[rule.status]}`}>
                {t(locale, `rule.status.${rule.status}`)}
              </span>
              <span className="text-[var(--color-ink)]">{rule.description}</span>
              {rule.detail && <span className="text-xs text-[var(--color-muted)]">— {rule.detail}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
