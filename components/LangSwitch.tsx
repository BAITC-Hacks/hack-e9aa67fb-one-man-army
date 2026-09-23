"use client";

/**
 * Sets the `locale` cookie read server-side by every page, then refreshes so
 * the server re-renders with the new language. Kept intentionally simple: a
 * hackathon build with one process has no route-based locale.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";

export function LangSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div role="group" aria-label={t(locale, "common.language")} className="flex gap-1">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === locale}
          disabled={pending}
          onClick={() => choose(code)}
          className={`min-h-[44px] min-w-[44px] rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
            code === locale
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
          }`}
        >
          {t(locale, `lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
