"use client";

/**
 * Demo identity picker (docs/architecture.md: "no external accounts may be
 * needed to test it"). Lists employee ids from the public GET /api/employees
 * contract (no names/skills - just enough to choose one), then starts a
 * session via POST /api/session. No password, no email, nothing pre-selected.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";
import { LangSwitch } from "@/components/LangSwitch";

interface EmployeeOption {
  employee_id: string;
  role: string;
  grade: string;
}

type ListState = "loading" | "empty" | "error" | "ready";

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [state, setState] = useState<ListState>("loading");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState<"employee" | "hr" | null>(null);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith("locale="))
      ?.split("=")[1];
    if (isLocale(cookieLocale)) setLocale(cookieLocale);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/employees")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<EmployeeOption[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setEmployees(data);
        setSelected(data[0]?.employee_id ?? "");
        setState(data.length === 0 ? "empty" : "ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(body: { role: "employee"; employeeId: string } | { role: "hr" }) {
    setSubmitError(false);
    setSubmitting(body.role);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("session failed");
      router.push(body.role === "hr" ? "/hr" : `/employee/${body.employeeId}`);
    } catch {
      setSubmitError(true);
      setSubmitting(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
          {t(locale, "login.title")}
        </h1>
        <LangSwitch locale={locale} />
      </div>
      <p className="mb-6 text-sm text-[var(--color-muted)]">{t(locale, "login.subtitle")}</p>

      <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">{t(locale, "login.employeeLabel")}</h2>

        {state === "loading" && (
          <div className="mt-3 animate-pulse space-y-2" aria-hidden="true">
            <div className="h-10 rounded-md bg-[var(--color-canvas)]" />
            <div className="h-11 w-40 rounded-md bg-[var(--color-canvas)]" />
          </div>
        )}

        {state === "empty" && (
          <div className="mt-3 text-sm text-[var(--color-muted)]">
            <p className="font-medium text-[var(--color-ink)]">{t(locale, "login.empty.title")}</p>
            <p className="mt-1">{t(locale, "login.empty.body")}</p>
          </div>
        )}

        {state === "error" && (
          <div className="mt-3 text-sm">
            <p className="font-medium text-red-700">{t(locale, "login.error.title")}</p>
            <p className="mt-1 text-[var(--color-muted)]">{t(locale, "login.error.body")}</p>
          </div>
        )}

        {state === "ready" && (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (selected) void signIn({ role: "employee", employeeId: selected });
            }}
          >
            <div>
              <label htmlFor="employee-id" className="block text-sm text-[var(--color-muted)]">
                {t(locale, "login.employeeSelectLabel")}
              </label>
              <select
                id="employee-id"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.employee_id} — {emp.role} ({emp.grade})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{t(locale, "login.employeeSelectHint")}</p>
            </div>
            <button
              type="submit"
              disabled={submitting !== null}
              className="min-h-[44px] w-full rounded-md bg-[var(--color-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              {submitting === "employee" ? t(locale, "common.loading") : t(locale, "login.employeeButton")}
            </button>
          </form>
        )}
      </section>

      <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-muted)]" role="separator">
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        {t(locale, "login.hrLabel")}
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <button
        type="button"
        onClick={() => void signIn({ role: "hr" })}
        disabled={submitting !== null}
        className="min-h-[44px] w-full rounded-md border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {submitting === "hr" ? t(locale, "common.loading") : t(locale, "login.hrButton")}
      </button>

      <div aria-live="polite">
        {submitError && <p className="mt-3 text-sm text-red-700">{t(locale, "login.error.body")}</p>}
      </div>
    </main>
  );
}
