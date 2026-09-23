# Final live smoke test: HTTP API, gpt-4o-mini (2026-09-23, 17:53 Astana)

**Setup.** A production build ran on a separate port with
`MODEL_REF=openai:gpt-4o-mini` and a fresh data store. The key came from the
local `.env` and was never committed. `/api/health` reported
`{"ref":"openai:gpt-4o-mini","offline":false}`. Every call went through the
real routes with a demo session and a same-origin header, exactly as the UI
calls them.

| Call | Locales | HTTP | Wall time | Observed |
| --- | --- | --- | --- | --- |
| `POST /api/employees/E0137/explanations` (3 recommendation cards) | en, ru, kk | 200 ×3 | 2.5–4.2 s | Per card, a mix of `llm` and `template`: en 1 llm / 2 template, ru 1/1, kk 1/1. The template cards are live replies the grounding check rejected. |
| `POST /api/employees/E0065/suggestions` (`PREREQ_BLOCKED`) | en, ru, kk | 200 ×3 | 3.6–4.1 s | `prerequisite_path` on SK_CONTAINERS via EV_010, with a code-written title in each locale. The real blocker (Containers & Orchestration → Kubernetes in Practice) is cited. |
| `POST /api/employees/E0192/suggestions` (`CATALOGUE_GAP`) | en, ru, kk | 200 ×3 | 3.1–8.1 s | `request_training` on SK_BI_TOOLS, with a rationale tailored to the employee's stated goal (Data Analyst). |

**Findings.**

- All 9 feature calls returned 200 inside the 10 s budget. The slowest was
  8.1 s (kk).
- Grounding still rejects part of the live explanation text at this sample
  size, so the UI shows the deterministic template for those cards. This is
  the intended fail-safe.
- The first attempt at the explanation calls returned 400. That was a mistake
  in the smoke script (it sent `eventIds` instead of `event_ids`); the API
  correctly rejected the malformed body.
- The source label for the suggestion calls was cut off in the captured log,
  so it is not claimed here. See `suggestions.md` for per-call sources in the
  larger runs.
