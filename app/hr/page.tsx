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
import { auditHrAggregatesView } from "@/lib/audit/hr-access";
import { getDataset } from "@/lib/data/load";
import { hrAggregates } from "@/lib/domain/hr";
import type { NoStepReason } from "@/lib/contracts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";
import { RoleBar } from "@/components/RoleBar";
import { KpiTile } from "@/components/KpiTile";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/DataTable";
import type { PillTone } from "@/components/Pill";

const PARTICIPATION_STATUS_ORDER = ["completed", "in_progress", "overdue", "no_show", "dropped", "declined"] as const;

function noStepTone(reason: NoStepReason): PillTone {
  if (reason === "AT_TOP_NO_GAP" || reason === "ALL_DONE") return "met";
  if (reason === "LOW_FIT" || reason === "PREREQ_BLOCKED") return "regular";
  return "neutral";
}

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
            className="min-h-[44px] rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            {t(locale, "common.retry")}
          </a>
        )}
        <Link
          href="/login"
          className="min-h-[44px] rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)]"
        >
          {t(locale, "common.back")}
        </Link>
      </div>
    </main>
  );
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

  // T5: every HR read of the aggregate analytics view is audited before any
  // data is rendered; if the audit write fails the view is denied (fail closed).
  try {
    await auditHrAggregatesView(session.id);
  } catch {
    return (
      <StatePage locale={locale} title={t(locale, "error.unavailable.title")} body={t(locale, "error.unavailable.body")} showRetry />
    );
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

  const withStepCount = aggregates.n - aggregates.noStep.length;
  const withStepPercent = aggregates.n > 0 ? Math.round((withStepCount / aggregates.n) * 100) : null;
  const mostLaggingSkill = aggregates.laggingSkills[0]?.name ?? null;
  const voluntaryRates = aggregates.participation.filter((row) => !row.mandatory && row.completionRate !== null);
  const voluntaryCompletion =
    voluntaryRates.length > 0
      ? Math.round((voluntaryRates.reduce((sum, row) => sum + (row.completionRate ?? 0), 0) / voluntaryRates.length) * 100)
      : null;

  const laggingColumns: DataTableColumn[] = [
    { key: "skill", header: t(locale, "hr.lagging.skill"), sortable: true, type: "text" },
    { key: "belowOwnGrade", header: t(locale, "hr.lagging.belowOwnGrade"), sortable: true, type: "count" },
    { key: "belowTarget", header: t(locale, "hr.lagging.belowTarget"), sortable: true, type: "count" },
    { key: "criticalBelowTarget", header: t(locale, "hr.lagging.criticalBelowTarget"), sortable: true, type: "count" },
  ];
  const laggingRows: DataTableRow[] = aggregates.laggingSkills.map((row) => ({
    id: row.skill_id,
    cells: {
      skill: row.name,
      belowOwnGrade: row.belowOwnGrade,
      belowTarget: row.belowTarget,
      criticalBelowTarget: row.criticalBelowTarget,
    },
  }));

  const noStepColumns: DataTableColumn[] = [
    { key: "employee", header: t(locale, "hr.noStep.employee"), sortable: true, type: "text" },
    { key: "role", header: t(locale, "hr.noStep.role"), sortable: true, type: "text" },
    { key: "grade", header: t(locale, "hr.noStep.grade"), sortable: true, type: "text" },
    { key: "reason", header: t(locale, "hr.noStep.reason"), sortable: true, type: "pill" },
  ];
  const noStepRows: DataTableRow[] = aggregates.noStep.map((row) => ({
    id: row.employee_id,
    cells: {
      employee: `${row.employee_id} — ${row.full_name}`,
      role: row.role,
      grade: row.grade,
      reason: {
        label: t(locale, `recs.noStep.short.${row.reason}`),
        title: t(locale, `recs.noStep.${row.reason}`),
        tone: noStepTone(row.reason),
      },
    },
  }));

  const participationColumns: DataTableColumn[] = [
    {
      key: "event",
      header: t(locale, "hr.participation.event"),
      sortable: true,
      type: "text",
      cellClassName: "max-w-[220px] break-words",
    },
    { key: "mandatory", header: t(locale, "hr.participation.mandatory"), sortable: true, type: "text" },
    {
      key: "completionRate",
      header: t(locale, "hr.participation.completionRateShort"),
      headerTitle: t(locale, "hr.participation.completionRate"),
      sortable: true,
      type: "number",
      suffix: "%",
    },
    ...PARTICIPATION_STATUS_ORDER.map(
      (status): DataTableColumn => ({
        key: status,
        header: t(locale, `hr.participation.status.short.${status}`),
        headerTitle: t(locale, `hr.participation.status.${status}`),
        sortable: true,
        type: "count",
      }),
    ),
  ];
  const participationRows: DataTableRow[] = aggregates.participation.map((row) => {
    const cells: DataTableRow["cells"] = {
      event: row.title,
      mandatory: row.mandatory ? t(locale, "hr.participation.mandatoryYes") : t(locale, "hr.participation.mandatoryNo"),
      completionRate: row.completionRate === null ? null : Math.round(row.completionRate * 100),
    };
    for (const status of PARTICIPATION_STATUS_ORDER) cells[status] = row.byStatus[status] ?? 0;
    return { id: row.event_id, cells };
  });

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
            className="min-h-[44px] rounded-md border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)]"
          >
            {t(locale, "hr.importLink")}
          </Link>
        </section>

        <section aria-label={t(locale, "hr.title")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label={t(locale, "hr.kpi.covered")} value={String(aggregates.n)} />
          <KpiTile
            label={t(locale, "hr.kpi.withStep")}
            value={withStepPercent === null ? t(locale, "hr.kpi.notAvailable") : `${withStepPercent}%`}
          />
          <KpiTile label={t(locale, "hr.kpi.laggingSkill")} value={mostLaggingSkill ?? t(locale, "hr.kpi.notAvailable")} />
          <KpiTile
            label={t(locale, "hr.kpi.completion")}
            value={voluntaryCompletion === null ? t(locale, "hr.kpi.notAvailable") : `${voluntaryCompletion}%`}
          />
        </section>

        <section aria-labelledby="lagging-heading">
          <h2 id="lagging-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "hr.lagging.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "hr.lagging.subtitle")}</p>
          {aggregates.laggingSkills.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "hr.lagging.empty")}</p>
          ) : (
            <div className="mt-3">
              <DataTable
                columns={laggingColumns}
                rows={laggingRows}
                searchPlaceholder={t(locale, "table.searchPlaceholder.skills")}
                noMatchesText={t(locale, "table.noMatches")}
                resultCountTemplate={t(locale, "table.resultCount")}
                suppressedLabel={t(locale, "hr.suppressedChip")}
                suppressedTitle={t(locale, "hr.suppressedTitle")}
                minWidthClassName="min-w-[520px]"
              />
              <p className="mt-2 text-xs text-[var(--color-muted)]">{t(locale, "hr.legend.suppressed")}</p>
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
            <div className="mt-3">
              <DataTable
                columns={noStepColumns}
                rows={noStepRows}
                searchPlaceholder={t(locale, "table.searchPlaceholder.employees")}
                noMatchesText={t(locale, "table.noMatches")}
                resultCountTemplate={t(locale, "table.resultCount")}
                suppressedLabel={t(locale, "hr.suppressedChip")}
                suppressedTitle={t(locale, "hr.suppressedTitle")}
                minWidthClassName="min-w-[560px]"
              />
              <p className="mt-2 text-xs text-[var(--color-muted)]">{t(locale, "hr.legend.noStepReason")}</p>
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
            <div className="mt-3">
              <DataTable
                columns={participationColumns}
                rows={participationRows}
                searchPlaceholder={t(locale, "table.searchPlaceholder.events")}
                noMatchesText={t(locale, "table.noMatches")}
                resultCountTemplate={t(locale, "table.resultCount")}
                suppressedLabel={t(locale, "hr.suppressedChip")}
                suppressedTitle={t(locale, "hr.suppressedTitle")}
                emptyCellText={t(locale, "hr.participation.noRate")}
                scrollHintText={t(locale, "table.scrollHint")}
              />
              <p className="mt-2 text-xs text-[var(--color-muted)]">{t(locale, "hr.legend.participationStatuses")}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{t(locale, "hr.legend.suppressed")}</p>
            </div>
          )}
        </section>

        <p className="text-xs text-[var(--color-muted)]">{tf(locale, "hr.sampleSize", { n: aggregates.n })}</p>
      </main>
    </>
  );
}
