"use client";

/**
 * One recommended step: headline facts, a "why this step" toggle (score
 * breakdown + eligibility trace, fetched from the API contract), and the
 * Complete / Not useful actions. No dark patterns: both actions are equally
 * styled buttons, neither is pre-selected, and dismissing never re-appears
 * without the employee's own choice.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Explanation, Recommendation } from "@/lib/contracts";
import type { Locale } from "@/lib/i18n/i18n";
import { t, tf } from "@/lib/i18n/dict";
import { TraceView } from "./TraceView";

type ActionState = "idle" | "busy" | "error" | "done";

export function RecCard({
  rec,
  employeeId,
  locale,
  readOnly = false,
}: {
  rec: Recommendation;
  employeeId: string;
  locale: Locale;
  /** HR viewing another employee's profile: actions are the employee's own
   *  choice to make, not HR's - the server also rejects these with 403. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [traceOpen, setTraceOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationState, setExplanationState] = useState<ActionState>("idle");
  const [completeState, setCompleteState] = useState<ActionState>("idle");
  const [dismissState, setDismissState] = useState<ActionState>("idle");

  async function toggleTrace() {
    const next = !traceOpen;
    setTraceOpen(next);
    if (next && explanationState === "idle") {
      setExplanationState("busy");
      try {
        const res = await fetch(`/api/employees/${employeeId}/explanations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_ids: [rec.event_id], locale }),
        });
        if (!res.ok) throw new Error("explain failed");
        const body = (await res.json()) as { explanations: Explanation[] };
        setExplanation(body.explanations[0] ?? null);
        setExplanationState("done");
      } catch {
        setExplanationState("error");
      }
    }
  }

  async function complete() {
    setCompleteState("busy");
    try {
      const res = await fetch(`/api/employees/${employeeId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: rec.event_id }),
      });
      if (!res.ok) throw new Error("complete failed");
      setCompleteState("done");
      router.refresh();
    } catch {
      setCompleteState("error");
    }
  }

  async function dismiss() {
    setDismissState("busy");
    try {
      const res = await fetch(`/api/employees/${employeeId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: rec.event_id }),
      });
      if (!res.ok) throw new Error("dismiss failed");
      setDismissState("done");
      router.refresh();
    } catch {
      setDismissState("error");
    }
  }

  return (
    <li className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-ink)]">{rec.title}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t(locale, "recs.duration")}: {tf(locale, "recs.durationHours", { h: rec.duration_hours })} ·{" "}
            {t(locale, "recs.format")}: {rec.format} ·{" "}
            {rec.next_session
              ? `${t(locale, "recs.nextSession")}: ${rec.next_session}`
              : t(locale, "recs.noSession")}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-ink)]">
          {t(locale, "recs.score")}: {rec.score}
        </span>
      </div>

      {rec.expected.length > 0 && (
        <p className="mt-2 text-sm text-[var(--color-ink)]">
          {t(locale, "recs.expectedTitle")}:{" "}
          {rec.expected
            .map((e) => tf(locale, "recs.expectedRow", { skill: e.skill_id, from: e.from, to: e.to, max: e.max_level }))
            .join("; ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleTrace}
          aria-expanded={traceOpen}
          className="min-h-[44px] rounded-md border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {traceOpen ? t(locale, "recs.hideWhy") : t(locale, "recs.whyThisStep")}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={complete}
            disabled={completeState === "busy" || completeState === "done"}
            className="min-h-[44px] rounded-md bg-[var(--color-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {completeState === "busy" ? t(locale, "recs.completing") : t(locale, "recs.completeButton")}
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissState === "busy" || dismissState === "done"}
            className="min-h-[44px] rounded-md border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {dismissState === "busy" ? t(locale, "recs.dismissing") : t(locale, "recs.dismissButton")}
          </button>
        )}
      </div>

      {!readOnly && (
        <div aria-live="polite" className="mt-2 text-sm">
          {completeState === "done" && <p className="text-emerald-700">{t(locale, "recs.completeSuccess")}</p>}
          {completeState === "error" && <p className="text-red-700">{t(locale, "recs.completeError")}</p>}
          {dismissState === "done" && <p className="text-emerald-700">{t(locale, "recs.dismissSuccess")}</p>}
          {dismissState === "error" && <p className="text-red-700">{t(locale, "recs.dismissError")}</p>}
        </div>
      )}

      {traceOpen && (
        <>
          <TraceView
            factors={rec.factors}
            rules={rec.rules}
            score={rec.score}
            scoringVersion="scoring.v1"
            locale={locale}
          />
          <div aria-live="polite" className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm">
            {explanationState === "busy" && <p className="text-[var(--color-muted)]">{t(locale, "common.loading")}</p>}
            {explanationState === "error" && (
              <p className="text-red-700">{t(locale, "error.unavailable.body")}</p>
            )}
            {explanationState === "done" && explanation && (
              <div>
                <p className="font-medium text-[var(--color-ink)]">{explanation.headline}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--color-ink)]">
                  {explanation.why.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <span className="mt-1 inline-block rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  {t(locale, `explain.source.${explanation.source}`)}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </li>
  );
}
