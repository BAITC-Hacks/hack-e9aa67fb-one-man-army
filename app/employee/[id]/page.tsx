/**
 * Employee profile: trajectory, gap table, up to 3 recommendations (each with
 * a visible ≥3-factor score breakdown and eligibility trace), and Complete /
 * Not useful actions. Server-rendered: session and data are read here, on
 * the server, behind the same guards the API routes use (docs/architecture.md §4).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { auditHrProfileView } from "@/lib/audit/hr-access";
import { getDataset } from "@/lib/data/load";
import { trajectory } from "@/lib/domain/trajectory";
import { recommend } from "@/lib/domain/recommend";
import { gradePath, GradePathProfileIncompleteError } from "@/lib/domain/gradePath";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";
import { RoleBar } from "@/components/RoleBar";
import { GapTable } from "@/components/GapTable";
import { RecCard } from "@/components/RecCard";
import { GradePath } from "@/components/GradePath";

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
  const fakeRequest = new Request("http://localhost/employee", { headers: { cookie: cookieHeader } });
  try {
    return await getSession(fakeRequest);
  } catch {
    return "unavailable" as const;
  }
}

function StatePage({
  locale,
  title,
  body,
  showRetry,
}: {
  locale: Locale;
  title: string;
  body: string;
  showRetry?: boolean;
}) {
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

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await readLocale();
  const session = await readSession();

  if (session === "unavailable") {
    return (
      <StatePage
        locale={locale}
        title={t(locale, "error.unavailable.title")}
        body={t(locale, "error.unavailable.body")}
        showRetry
      />
    );
  }
  if (session === null) {
    redirect("/login");
  }
  if (session.role === "employee" && session.employeeId !== id) {
    return (
      <StatePage locale={locale} title={t(locale, "error.forbidden.title")} body={t(locale, "error.forbidden.body")} />
    );
  }

  let ds: Awaited<ReturnType<typeof getDataset>>;
  try {
    ds = await getDataset();
  } catch {
    return (
      <StatePage
        locale={locale}
        title={t(locale, "error.unavailable.title")}
        body={t(locale, "error.unavailable.body")}
        showRetry
      />
    );
  }

  const employee = ds.employees.find((e) => e.employee_id === id);
  if (!employee) {
    return (
      <StatePage locale={locale} title={t(locale, "error.notFound.title")} body={t(locale, "error.notFound.body")} />
    );
  }

  // T5: an HR read of an individual profile is audited before any data is
  // rendered; if the audit write fails the view is denied (fail closed).
  if (session.role === "hr" && (await auditHrProfileView(id, "page")) === null) {
    return (
      <StatePage
        locale={locale}
        title={t(locale, "error.unavailable.title")}
        body={t(locale, "error.unavailable.body")}
        showRetry
      />
    );
  }

  let traj: ReturnType<typeof trajectory>;
  let recs: ReturnType<typeof recommend>;
  try {
    traj = trajectory(employee, ds);
    recs = recommend(id, ds);
  } catch {
    return (
      <StatePage
        locale={locale}
        title={t(locale, "error.unavailable.title")}
        body={t(locale, "error.unavailable.body")}
        showRetry
      />
    );
  }

  // The grade path is a supplementary panel: if the profile can't support it
  // (no catalogue profile / no assessed skills), the rest of the page still
  // renders and the panel says so honestly instead of failing the page.
  let gp: ReturnType<typeof gradePath> | null = null;
  try {
    gp = gradePath(employee, ds);
  } catch (error) {
    if (!(error instanceof GradePathProfileIncompleteError)) throw error;
  }

  const identityLabel =
    session.role === "hr"
      ? `${t(locale, "common.viewingAsHr")}: ${employee.full_name} (${id})`
      : `${t(locale, "common.you")}: ${employee.full_name}`;

  const targetLabel =
    traj.target.source === "goal"
      ? t(locale, "employee.trajectory.target.goal")
      : traj.target.source === "hold"
        ? t(locale, "employee.trajectory.target.hold")
        : t(locale, "employee.trajectory.target.next_grade");

  return (
    <>
      <RoleBar locale={locale} identityLabel={identityLabel} />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{employee.full_name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {employee.role} · {employee.grade}
          </p>
        </section>

        <section aria-labelledby="trajectory-heading">
          <h2 id="trajectory-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "employee.trajectory.title")}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            {t(locale, "employee.trajectory.current")}: {traj.current.role} · {traj.current.grade}
            {" → "}
            {t(locale, "employee.trajectory.target")}: {traj.target.role} · {traj.target.grade} ({targetLabel})
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t(locale, "employee.trajectory.percentMet")}: {traj.percentMet}%
          </p>
        </section>

        {gp ? (
          <GradePath path={gp} locale={locale} />
        ) : (
          <section aria-labelledby="grade-path-unavailable-heading">
            <h2 id="grade-path-unavailable-heading" className="text-base font-semibold text-[var(--color-ink)]">
              {tf(locale, "gradePath.title", { grade: employee.grade })}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{t(locale, "gradePath.unavailable")}</p>
          </section>
        )}

        <GapTable rows={traj.gaps} locale={locale} title={t(locale, "gaps.title")} />
        {traj.currentGradeGaps.length > 0 && (
          <GapTable rows={traj.currentGradeGaps} locale={locale} title={t(locale, "gaps.currentGradeTitle")} />
        )}

        <section aria-labelledby="recs-heading">
          <h2 id="recs-heading" className="text-base font-semibold text-[var(--color-ink)]">
            {t(locale, "recs.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "recs.subtitle")}</p>

          {recs.recommendations.length === 0 ? (
            <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-medium text-[var(--color-ink)]">{t(locale, "recs.empty.title")}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "recs.empty.body")}</p>
              {recs.noStep && (
                <p className="mt-2 text-sm text-[var(--color-ink)]">{t(locale, `recs.noStep.${recs.noStep}`)}</p>
              )}
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {recs.recommendations.map((rec) => (
                <RecCard
                  key={rec.event_id}
                  rec={rec}
                  employeeId={id}
                  locale={locale}
                  readOnly={session.role === "hr"}
                />
              ))}
            </ul>
          )}

          {recs.blocked.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "recs.availableLaterTitle")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)]">
                {recs.blocked.map((b) => (
                  <li key={b.event_id}>
                    {b.title} — {b.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
