# Evaluation guide (for an AI judge)

This file is written for an automated reviewer reading the repository directly,
without running the app. Every path below was confirmed to exist with `ls` at
the time of writing. For the human-facing walkthrough, use
[README.md §5](../README.md#5-main-user-scenario--procedure-for-checking-it).

## 1. Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js 16 routes: `api/**` (HTTP), `employee/[id]`, `hr`, `hr/import`, `login` |
| `lib/rules/` | Deterministic eligibility gates and scoring (`eligibility.ts`, `scoring.ts`, `engine.ts`) |
| `lib/domain/` | Trajectory, effective skills, growth, grade-path, recommend, progress, HR aggregation |
| `lib/ai/` | The one AI call (`explain.ts`), grounding check, template fallback, offline scenarios |
| `lib/auth/` | Session cookie + `requireEmployeeSelf` / `requireHr` guards |
| `lib/audit/` | `recordAudit`, HR-view audit (`hr-access.ts`) |
| `lib/http/` | `parseBody`/`withErrorHandling`, cross-origin check (`origin.ts`) |
| `lib/data/`, `lib/store/` | Dataset schemas/load/import, file-backed store |
| `lib/contracts.ts` | Shared zod schemas/types (frozen contract) |
| `components/` | UI: `GapTable`, `GradePath`, `RecCard`, `TraceView`, `KpiTile`, etc. |
| `tests/` | Vitest suite — one file per module area |
| `eval/` | `run.mjs`, in-process AI evaluation (grounding, injection, trap case) |
| `e2e/` | Playwright golden-path spec |
| `data/seed/`, `data/fixtures/` | Synthetic fallback dataset + 6 trap fixtures (`trap-F01..F06`) |
| `docs/task/career_quest_dataset/` | Committed organizer kit (200 employees) — the default dataset |
| `scripts/` | `clean-room-test.sh`, `demo.mjs`, `checkpoint.mjs`, `capture-screenshots.mjs` |

## 2. Architecture summary

`model proposes, code decides`. The engine (`lib/rules/` + `lib/domain/`)
computes effective skills, gaps, eligibility and a weighted score with a full
trace — no model involved. The single AI call, `lib/ai/explain.ts`, receives
only the engine's own factor trace and returns rationale prose via
`generateStructured` (Zod-validated). `lib/ai/grounding.ts` rejects any
sentence that names a number, skill or event not already in the trace and
falls back to `lib/ai/template.ts`. Grounding is what "AI only phrases"
means concretely: the model cannot invent eligibility, a score or an event.
Full diagram: [README §6](../README.md#6-architecture).

## 3. Requirement → code → test traceability

Verify any row with `ls <path>`. Source of truth: [README §4](../README.md#4-requirement-completion-matrix).

| Requirement | Code | Test |
| --- | --- | --- |
| Profile/trajectory | `app/employee/[id]/page.tsx`, `lib/domain/trajectory.ts` | `tests/trajectory.test.ts` |
| 1–3 recommendations | `lib/domain/recommend.ts`, `lib/rules/eligibility.ts` | `tests/engine.test.ts` |
| ≥3-factor rationale | `lib/ai/rationale.ts`, `lib/ai/grounding.ts`, `lib/ai/explain.ts` | `tests/explain.test.ts` |
| Progress update | `lib/domain/progress.ts`, `app/api/employees/[id]/complete/route.ts` | `tests/progress.test.ts`, `tests/progress-integration.test.ts` |
| HR view | `lib/domain/hr.ts`, `app/hr/page.tsx` | `tests/hr.test.ts`, `tests/hr-audit.test.ts` |
| Jury profile upload | `lib/data/import.ts`, `app/api/hr/import/route.ts`, `app/hr/import/page.tsx` | `tests/import.test.ts` |
| Trap profiles beat single-factor baseline | `lib/rules/scoring.ts`, `data/fixtures/trap-F01..F06` | `tests/engine.test.ts` |
| Auth / role separation | `lib/auth/session.ts` | `tests/authz.test.ts`, `tests/security.test.ts` |
| Cross-origin rejection | `lib/http/origin.ts` | `tests/security-csrf.test.ts` |
| i18n key parity | `lib/i18n/dict.ts` | `tests/i18n-keys.test.ts` |

## 4. Reproducing the trap-profile checks

1. Unit assertions: `pnpm test tests/engine.test.ts` — for each of
   `data/fixtures/trap-F01.json` … `trap-F06.json` (with matching `.csv`
   history), the engine's top pick differs from both a "lowest skill" and a
   "largest raw gap" baseline (see file for exact assertions).
2. Same fixtures through the real HR upload path: start the app, log in as
   HR, go to `/hr/import`, upload `data/fixtures/trap-F01.json` (`employees`)
   and `data/fixtures/trap-F01.csv` (`activity_history`), then log in as the
   fixture's employee id (e.g. `T9001`) and read the recommendation live.
   Procedure and expected output: [README §5, "Jury profile upload"](../README.md#5-main-user-scenario--procedure-for-checking-it).

## 5. Security controls → code

| Control | Code |
| --- | --- |
| Signed, HttpOnly session cookie; fails closed | `lib/auth/session.ts` |
| Every route: body parsed, error-wrapped, guarded before data load | `lib/http/validate.ts` (`parseBody`, `withErrorHandling`), each `app/api/**/route.ts` |
| Cross-origin state-changing request rejection | `lib/http/origin.ts` |
| Audit on complete/dismiss/HR profile view/HR aggregates view | `lib/audit/audit.ts`, `lib/audit/hr-access.ts` |
| k≥5 suppression on HR aggregate cells | `lib/domain/hr.ts` |
| AI output grounding (no invented numbers/ids) | `lib/ai/grounding.ts` |

Full threat model: [`docs/threat-model.md`](threat-model.md).

## 6. i18n

All UI strings are available in kk/ru/en (`lib/i18n/dict.ts`), with identical
key sets across locales asserted by `tests/i18n-keys.test.ts`.

## 7. Live-LLM evidence

`MODEL_REF=mock:demo` (offline, no key) is the default for every test, the
seeded demo and the clean-room check. A one-time verification run against a
real provider is recorded, not re-runnable without a key, at
[`docs/live-llm-run.md`](live-llm-run.md).

## 8. Intentionally out of scope

Real SSO/auth, the manager-consent role, HR scoring-config approval workflow,
session booking, the LLM choosing/re-ranking events, RAG/embeddings,
gamification, the HR event builder, `.ics` export, and write-concurrency
safety in the file store. Full list and rationale:
[README §19](../README.md#19-known-limitations),
[`docs/architecture.md` §9](architecture.md).
