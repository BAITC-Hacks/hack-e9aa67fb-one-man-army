/**
 * HR overview: lagging skills, employees with no recommended step, and
 * participation by activity. Aggregate only - no per-employee ranking or
 * leaderboard (N-02). Small groups (n < 5) are shown as suppressed, not
 * silently hidden or guessed at.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getDataset } from "@/lib/data/load";
import { hrAggregates } from "@/lib/domain/hr";
import type { Count } from "@/lib/contracts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";
import { RoleBar } from "@/components/RoleBar";

async function readLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

async function readSession() {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const fakeRequest = new Request("http://localhost/hr", { headers: { cookie: cookieHeader } });
  try {
    return await getSession(fakeRequest);
  } catch {
    return "unavailable" as const;
  }
}

function StatePage({ locale, title, body, showRetry }: { locale: Locale; title: string; body: string; showRetry?: boolean }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{body}</p>
      <div className="mt-6 flex justify-center gap-3">
        {showRetry && (
          <a
            href="."
            className="min-h-[44px] rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t(locale, "common.retry")}
          </a>
        )}
        <Link
          href="/login"
          className="min-h-[44px] rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)]"
        >
          {t(locale, "common.back")}
        </Link>
      </div>
    </main>
  );
}

function CountCell({ value, locale }: { value: Count; locale: Locale }) {
  if (typeof value === "object") {
    return <span className="italic text-[var(--color-muted)]">{t(locale, "hr.suppressed")}</span>;
  }
  return <span className="tabular-nums">{value}</span>;
}

export default async function HrPage() {
  const locale = await readLocale();
  const session = await readSession();

  if (session === "unavailable") {
    return (
      <StatePage locale={locale} title={t(locale, "error.unavailable.title")} body={t(locale, "error.unavailable.body")} showRetry />
    );
  }
  if (session === null) redirect("/login");
  if (session.role !== "hr") {
    return <StatePage locale={locale} title={t(locale, "error.forbidden.title")} body={t(locale, "error.forbidden.body")} />;
  }

  let aggregates: ReturnType<typeof hrAggregates>;
  try {
    const ds = await getDataset();
    aggregates = hrAggregates(ds);
  } catch {
    return (
      <StatePage locale={locale} title={t(locale, "error.unavailable.title")} body={t(locale, "error.unavailable.body")} showRetry />
    );
  }

  return (
    <>
      <RoleBar locale={locale} identityLabel={t(locale, "common.hr")} />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{t(locale, "hr.title")}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "hr.subtitle")}</p>
          </div>
          <Link
            href="/hr/import"
            className="min-h-[44px] rounded-md border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)]"
          >
            {t(locale, "hr.importLink")}
          </Link>
        </section>

        <section aria-labelledby="lagging-heading">
          <h2 id="lagging-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "hr.lagging.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "hr.lagging.subtitle")}</p>
          {aggregates.laggingSkills.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "hr.lagging.empty")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t(locale, "hr.lagging.skill")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.lagging.belowOwnGrade")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.lagging.belowTarget")}
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium">
                      {t(locale, "hr.lagging.criticalBelowTarget")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.laggingSkills.map((row) => (
                    <tr key={row.skill_id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--color-ink)]">{row.name}</td>
                      <td className="px-3 py-2">
                        <CountCell value={row.belowOwnGrade} locale={locale} />
                      </td>
                      <td className="px-3 py-2">
                        <CountCell value={row.belowTarget} locale={locale} />
                      </td>
                      <td className="py-2 pl-3">
                        <CountCell value={row.criticalBelowTarget} locale={locale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="nostep-heading">
          <h2 id="nostep-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "hr.noStep.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "hr.noStep.subtitle")}</p>
          {aggregates.noStep.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "hr.noStep.empty")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t(locale, "hr.noStep.employee")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.noStep.role")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.noStep.grade")}
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium">
                      {t(locale, "hr.noStep.reason")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.noStep.map((row) => (
                    <tr key={row.employee_id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--color-ink)]">
                        {row.employee_id} — {row.full_name}
                      </td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2">{row.grade}</td>
                      <td className="py-2 pl-3">{t(locale, `recs.noStep.${row.reason}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="participation-heading">
          <h2 id="participation-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "hr.participation.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "hr.participation.subtitle")}</p>
          {aggregates.participation.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "hr.participation.empty")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t(locale, "hr.participation.event")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.participation.mandatory")}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t(locale, "hr.participation.completionRate")}
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium">
                      {Object.keys(aggregates.participation[0]?.byStatus ?? {}).join(" / ")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.participation.map((row) => (
                    <tr key={row.event_id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--color-ink)]">{row.title}</td>
                      <td className="px-3 py-2">
                        {row.mandatory ? t(locale, "hr.participation.mandatoryYes") : t(locale, "hr.participation.mandatoryNo")}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.completionRate === null
                          ? t(locale, "hr.participation.noRate")
                          : `${Math.round(row.completionRate * 100)}%`}
                      </td>
                      <td className="py-2 pl-3 text-xs">
                        {Object.entries(row.byStatus)
                          .map(([status, count]) => `${status}: ${typeof count === "object" ? t(locale, "hr.suppressed") : count}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-[var(--color-muted)]">{tf(locale, "hr.sampleSize", { n: aggregates.n })}</p>
      </main>
    </>
  );
}
