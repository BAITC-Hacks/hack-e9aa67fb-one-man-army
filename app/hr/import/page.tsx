"use client";

/**
 * Dataset import UI (docs/architecture.md §4, R-09). HR only - the page does
 * a client-side check via GET /api/session for a fast redirect, but the real
 * control is server-side: POST /api/hr/import fails closed (401/403) for
 * anyone else regardless of what this page renders (docs/threat-model.md T3).
 * Uploading valid rows makes the employee show up with recommendations with
 * no restart, because the import route calls `invalidateDataset()`.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";
import { RoleBar } from "@/components/RoleBar";
import type { ImportReport } from "@/lib/contracts";

const FIELDS = ["employees", "activity_history", "events", "skills"] as const;
type FieldName = (typeof FIELDS)[number];

type Guard = "checking" | "denied" | "ok";

export default function ImportPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [guard, setGuard] = useState<Guard>("checking");
  const [files, setFiles] = useState<Partial<Record<FieldName, File>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith("locale="))
      ?.split("=")[1];
    if (isLocale(cookieLocale)) setLocale(cookieLocale);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session: { role?: string } | null) => {
        if (cancelled) return;
        if (session?.role === "hr") setGuard("ok");
        else {
          setGuard("denied");
          router.push("/login");
        }
      })
      .catch(() => {
        if (!cancelled) setGuard("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    const entries = Object.entries(files).filter(([, f]) => f) as [FieldName, File][];
    if (entries.length === 0) {
      setError(t(locale, "import.selectAtLeastOne"));
      return;
    }
    const form = new FormData();
    for (const [field, file] of entries) form.append(field, file);

    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/import", { method: "POST", body: form });
      if (!res.ok) {
        setError(t(locale, "import.error.body"));
        return;
      }
      const data = (await res.json()) as ImportReport;
      setReport(data);
    } catch {
      setError(t(locale, "import.error.body"));
    } finally {
      setSubmitting(false);
    }
  }

  if (guard !== "ok") {
    return null;
  }

  return (
    <>
      <RoleBar locale={locale} identityLabel={t(locale, "common.hr")} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
            {t(locale, "import.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "import.subtitle")}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border border-[var(--color-line)] p-4">
          {FIELDS.map((field) => (
            <div key={field}>
              <label htmlFor={field} className="block text-sm text-[var(--color-muted)]">
                {t(locale, `import.field.${field}`)}
              </label>
              <input
                id={field}
                type="file"
                accept={field === "activity_history" ? ".csv" : ".json"}
                onChange={(e) => setFiles((prev) => ({ ...prev, [field]: e.target.files?.[0] }))}
                className="mt-1 block w-full text-sm text-[var(--color-ink)]"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? t(locale, "import.submitting") : t(locale, "import.submit")}
          </button>
        </form>

        {report && (
          <section aria-labelledby="report-heading" className="space-y-4">
            <h2 id="report-heading" className="text-base font-semibold text-[var(--color-ink)]">
              {t(locale, "import.report.title")}
            </h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-medium text-[var(--color-ink)]">{t(locale, "import.report.accepted")}</p>
                <ul className="mt-1 text-[var(--color-muted)]">
                  {Object.entries(report.accepted).map(([kind, n]) => (
                    <li key={kind}>
                      {kind}: {n}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-[var(--color-ink)]">{t(locale, "import.report.updated")}</p>
                <ul className="mt-1 text-[var(--color-muted)]">
                  {Object.entries(report.updated).map(([kind, n]) => (
                    <li key={kind}>
                      {kind}: {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">{t(locale, "import.report.errors")}</p>
              {report.errors.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--color-muted)]">{t(locale, "import.report.noErrors")}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {t(locale, "import.report.file")}
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          {t(locale, "import.report.row")}
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          {t(locale, "import.report.field")}
                        </th>
                        <th scope="col" className="py-2 pl-3 font-medium">
                          {t(locale, "import.report.message")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.errors.map((err, idx) => (
                        <tr key={idx} className="border-b border-[var(--color-line)] last:border-0">
                          <td className="py-2 pr-3 text-[var(--color-ink)]">{err.file}</td>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2">{err.field}</td>
                          <td className="py-2 pl-3">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
