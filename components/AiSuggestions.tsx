"use client";

/**
 * AI development suggestions (operator-approved extension, 2026-09-23).
 * Shown only by the caller, when the employee has NO catalogue
 * recommendation (noStep ALL_DONE / PREREQ_BLOCKED / CATALOGUE_GAP). Fetches
 * on mount, labels its source honestly, and never implies these are
 * mandatory - see "suggest.disclaimer".
 */
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";

interface SuggestionItem {
  type: string;
  skill_id: string;
  event_ids?: string[];
  title: string;
  rationale: string;
}

interface SuggestResult {
  suggestions: SuggestionItem[];
  source: "llm" | "mock" | "template";
}

interface SuggestResponse {
  applicable: boolean;
  result?: SuggestResult;
}

type State = "loading" | "error" | "empty" | "done";

export function AiSuggestions({ employeeId, locale }: { employeeId: string; locale: Locale }) {
  const [state, setState] = useState<State>("loading");
  const [result, setResult] = useState<SuggestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/employees/${employeeId}/suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });
        if (!res.ok) throw new Error("suggest failed");
        const body = (await res.json()) as SuggestResponse;
        if (cancelled) return;
        if (!body.applicable || !body.result || body.result.suggestions.length === 0) {
          setState("empty");
          return;
        }
        setResult(body.result);
        setState("done");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, locale]);

  if (state === "loading") {
    return <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "common.loading")}</p>;
  }
  if (state === "error") {
    return <p className="mt-3 text-sm text-red-700">{t(locale, "error.unavailable.body")}</p>;
  }
  if (state === "empty" || !result) return null;

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[var(--color-ink)]">{t(locale, "suggest.title")}</p>
        <span className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {t(locale, `suggest.source.${result.source}`)}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {result.suggestions.map((s, i) => (
          <li key={`${s.type}-${s.skill_id}-${i}`} className="rounded-md border border-[var(--color-line)] p-3">
            <p className="font-medium text-[var(--color-ink)]">{s.title}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{s.rationale}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--color-muted)]">{t(locale, "suggest.disclaimer")}</p>
    </div>
  );
}
