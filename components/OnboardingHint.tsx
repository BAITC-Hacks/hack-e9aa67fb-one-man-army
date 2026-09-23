"use client";

/**
 * First-visit hint on the employee page: three things on the page, in plain
 * language. Dismissible and remembered in localStorage (best-effort - if
 * storage is unavailable the hint just shows again next time, which is fine).
 */
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";

const STORAGE_KEY = "cq_onboarding_dismissed";

export function OnboardingHint({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // best-effort only - nothing to fall back to
    }
  }

  if (!visible) return null;

  return (
    <div
      role="note"
      className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-gold)] bg-[#fff8e8] p-4 text-sm text-[var(--color-ink)]"
    >
      <div>
        <p className="font-medium">{t(locale, "onboarding.title")}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[var(--color-muted)]">
          <li>{t(locale, "onboarding.item1")}</li>
          <li>{t(locale, "onboarding.item2")}</li>
          <li>{t(locale, "onboarding.item3")}</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="min-h-[44px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {t(locale, "onboarding.dismiss")}
      </button>
    </div>
  );
}
