"use client";

/**
 * AI development suggestions (operator-approved extension, 2026-09-23).
 * Shown only by the caller, when the employee has NO catalogue
 * recommendation (noStep ALL_DONE / PREREQ_BLOCKED / CATALOGUE_GAP). Fetches
 * on mount, labels its source honestly, and never implies these are
 * mandatory - see "suggest.caution". Styled deliberately distinct from
 * catalogue recommendation cards (dashed violet border, sparkle badges) so
 * an employee never mistakes a probabilistic AI idea for a vetted
 * recommendation.
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
  generatedBy?: "ai" | "template";
}

interface SuggestResult {
  suggestions: SuggestionItem[];
  source: "llm" | "mock" | "template";
  status?: "ok" | "no_reliable_suggestion";
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
        if (!body.applicable || !body.result) {
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

  const noReliable = result.status === "no_reliable_suggestion" || result.suggestions.length === 0;

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-violet-400 bg-violet-50 p-4 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
            {t(locale, "suggest.aiBadge")}
          </span>
          <p className="font-medium text-[var(--color-ink)]">{t(locale, "suggest.title")}</p>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs uppercase tracking-wide text-violet-700">
          {t(locale, `suggest.source.${result.source}`)}
        </span>
      </div>

      {noReliable ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t(locale, "suggest.status.no_reliable_suggestion")}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {result.suggestions.map((s, i) => (
              <li
                key={`${s.type}-${s.skill_id}-${i}`}
                className="rounded-md border border-dashed border-violet-300 bg-white/60 p-3 dark:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                    {t(locale, "suggest.aiBadge")}
                  </span>
                  <p className="font-medium text-[var(--color-ink)]">{s.title}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{s.rationale}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-muted)]">{t(locale, "suggest.disclaimer")}</p>
        </>
      )}
      <p className="mt-2 text-xs italic text-violet-700">{t(locale, "suggest.caution")}</p>
    </div>
  );
}
