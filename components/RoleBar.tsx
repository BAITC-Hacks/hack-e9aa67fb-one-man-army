"use client";

/** Top bar shown on every signed-in page: identity, language, logout. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";
import { LangSwitch } from "./LangSwitch";

export function RoleBar({ locale, identityLabel }: { locale: Locale; identityLabel: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
      <span className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        {t(locale, "app.title")}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-muted)]">{identityLabel}</span>
        <LangSwitch locale={locale} />
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="min-h-[44px] rounded-md border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {t(locale, "common.logout")}
        </button>
      </div>
    </header>
  );
}
