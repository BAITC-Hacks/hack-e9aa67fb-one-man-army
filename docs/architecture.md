# Architecture — Halyk Career Quest

Owner: `architect` · 2026-09-23 ~13:45 · Authoritative inputs: `docs/requirements.md`, `docs/domain.md`.

One Next.js 16 app, one process. There is no DB, ORM, queue, vector store, auth provider or second service. The dataset lives in memory, loaded from files. Mutations go to the existing file store (`lib/store/jsonl.ts`, under `DATA_DIR`). The engine decides everything deterministically. The LLM only rephrases the engine's trace.

**The rule: a model may suggest; only code decides.** Eligibility, scoring, ranking, skill arithmetic, authorization and every mutation run in `lib/rules/` and `lib/domain/` on the server. Model output is never read as a decision. Explanation text that fails the grounding check is thrown away and replaced with the deterministic template.

---

## 1. Module map (exact paths, one owner each)

The contracts in `lib/contracts.ts` are **frozen after this doc**. Changing them requires a note in this file and a message to every owner.

| Path | Owns | Owner |
| --- | --- | --- |
| `lib/contracts.ts` | All shared zod schemas + TS types from §3/§4 (domain objects, API bodies, reason codes). No logic | architect (frozen) |
| `lib/data/schemas.ts` | zod schemas for the 4 dataset files (§2). Accepts `{meta, employees}` or a bare array. CSV row schema with coercion | A |
| `lib/data/csv.ts` | Minimal RFC-4180 CSV parser (header row, quoted fields). No dependency | A |
| `lib/data/load.ts` | `getDataset(): Promise<Dataset>`, a cached in-memory singleton. Resolution order: `DATASET_DIR` env → `docs/task/career_quest_dataset/` if present → `data/seed/` (committed synthetic, same schema). Then it merges the overlays `imports.json` and `completions.jsonl` / `dismissals.jsonl` from the store. Also `invalidateDataset()` | A |
| `lib/data/import.ts` | `importFiles(files) → ImportReport`. Validates rows, checks references, upserts by `employee_id` / `record_id`, writes the overlay `imports.json`, calls `invalidateDataset()`. Valid rows are kept even when others fail | A |
| `data/seed/{skills.json,events.json,employees.json,activity_history.csv}` | Committed synthetic seed with the same schema (E-ids fictional). **Must contain an E0028-shaped profile and all trap fixtures** | A |
| `data/fixtures/trap-*.{json,csv}` | F-01…F-06 (ids T9001+), which double as jury-upload samples | A |
| `lib/domain/effective.ts` | `effectiveSkills(emp, history, events) → {assessed, effective, pending: PendingGain[]}`. Applies `completed` rows dated after `last_review_date`, in date order, using `applyGrowth` | A |
| `lib/domain/growth.ts` | `applyGrowth(level, gain, max) = max(level, min(level+gain, max))`. The only place this formula exists | A |
| `lib/domain/trajectory.ts` | `trajectory(emp, ds) → Trajectory`: target (goal / next grade / hold Lead), gap table, critical flags, % met, current-grade gaps | A |
| `lib/domain/history.ts` | `engagement(empId, event, ds) → {negative, positive, byFormat}`: similar = shared skill or same type+format, with a recency window and a manager-declined ×0.5 weight | A |
| `lib/rules/eligibility.ts` | `Rule<EligFacts>[]` in this order: `not-mandatory`, `audience-role`, `audience-grade`, `prereqs-met`, `not-completed` (EV_036 exempt), `not-in-progress`, `has-session`, `useful-gain`, `not-dismissed`. Evaluated per (employee, event) through `evaluateRules` | A |
| `lib/rules/scoring.ts` | `SCORING_CONFIG` (version `scoring.v1`, weights F1–F9 from domain §3) and `scoreEvent(facts) → {score, factors: Factor[]}` | A |
| `lib/domain/recommend.ts` | `recommend(empId, ds) → RecommendationResult`. Pipeline: eligibility → score → sort (tie-break: score desc, F1 desc, duration asc, event_id asc) → diversity (no two recs whose useful gain is on the same single skill) → keep score > 0 → top 3, else `[]` + `NoStepReason` | A |
| `lib/domain/progress.ts` | `completeEvent(empId, eventId, actor) → ProgressResult`. Appends to `completions.jsonl`, invalidates the cache, returns before/after + refreshed recs, `recordAudit` | A |
| `lib/domain/hr.ts` | `hrAggregates(ds) → HrAggregates`: lagging skills (vs own grade and target), no-step list (sorted by employee_id, never by score), participation by event. **Any cell with n < 5 is suppressed** as `{suppressed:true}` | A |
| `lib/auth/session.ts` | `getSession(req)` reads the signed HttpOnly cookie `cq_session` (HMAC-SHA256, `SESSION_SECRET` with a dev default) and returns `{role:"employee", employeeId} \| {role:"hr", id:"HR01"}` or null. Also `requireEmployeeSelf(req, id)` and `requireHr(req)`, which throw 401/403. **Fails closed.** | B |
| `lib/ai/explain.ts` | `explain(rec, locale) → Explanation`. `generateStructured` with an 8 s `AbortSignal` timeout → `groundingCheck` → on any failure `templateExplanation`. Never throws | B |
| `lib/ai/grounding.ts` | `groundingCheck(text, factors)`: every numeric token and every `SK_*` / `EV_*` id in the text must appear in the factor values. ≥ 3 distinct factor kinds are cited | B |
| `lib/ai/template.ts` | Deterministic kk/ru/en rationale built from `factors[]`. This is also the fallback | B |
| `lib/ai/scenarios.ts` | A mock scenario for the explain prompt that echoes the factors (so it passes grounding offline) | B |
| `app/api/**/route.ts` | Route handlers (§4). Each one runs `withErrorHandling` + `parseBody` + an auth guard **before** any data access | B |
| `lib/i18n/dict.ts` | All UI keys, kk/ru/en with identical key sets | C |
| `app/login/page.tsx` | Demo identity picker: employee id dropdown + "HR" button → `POST /api/session` | C |
| `app/employee/[id]/page.tsx` | Profile, trajectory gap table (assessed → effective, critical badge, % met), recommendations with an expandable trace + explanation, Complete / Not interested buttons, before → after panel with the formula, "available later" (failed gates with detail) | C |
| `app/hr/page.tsx` | 3 panels: lagging skills, no-step list (reason code), participation by event | C |
| `app/hr/import/page.tsx` | Multi-file upload → ImportReport table (row errors, counts) | C |
| `components/*` | `TraceView`, `GapTable`, `RecCard`, `LangSwitch`, `RoleBar` | C |
| `scripts/import.mjs` → `pnpm data:import <dir>` | CLI path for R-09 (calls `importFiles`) | A |
| `tests/*.test.ts` | Each owner writes tests for their own modules. `tests/authz.test.ts` → B | A/B/C |

Owners: **A** = data + domain + rules (critical path). **B** = auth + AI + API. **C** = UI + i18n. B and C code against `lib/contracts.ts` and can stub A's functions until they land.

### Load and merge order (deterministic)
`base files` → `imports.json` (upsert employees by id, history by record_id, events/skills optional replace-by-id) → `completions.jsonl` (in-app completions appended as history rows `status: completed, assigned_by: self, date: as_of_date`) → `dismissals.jsonl` (a per-employee set). `demo:reset` truncates the three overlay files. "Today" = `meta.as_of_date` (env `AS_OF_DATE` overrides). Never `new Date()` in domain code.

---

## 2. Dataset schemas (`lib/data/schemas.ts`)

```ts
Grade = z.enum(["Junior","Middle","Senior","Lead"])
SkillLevels = z.record(z.string().regex(/^SK_/), z.number().int().min(0).max(5))
SkillsFile = z.object({ meta: z.object({as_of_date: z.string()}).passthrough().optional(),
  proficiency_scale: z.record(z.string(), z.string()).optional(),
  skills: z.array(z.object({ skill_id, name, type: z.enum(["hard","soft"]), category, description })),
  role_profiles: z.array(z.object({ role: z.string(), grade: Grade,
     required_skills: SkillLevels, critical_skills: z.array(z.string()) })) })
Employee = z.object({ employee_id: z.string(), full_name: z.string(), department: z.string(),
  role: z.string(), grade: Grade, manager_id: z.string().nullable(), hire_date: z.string(),
  tenure_months: z.number().int(), work_format: z.enum(["office","hybrid","remote"]),
  preferred_language: z.enum(["kk","ru","en"]),
  career_goal: z.object({ target_role: z.string(), target_grade: Grade }).nullable(),
  skills: SkillLevels, last_review_date: z.string() })
EmployeesFile = z.union([ z.object({ meta: …optional, employees: z.array(z.unknown()) }), z.array(z.unknown()) ])
  // rows validated one by one so a bad row does not reject the file
Event = z.object({ event_id, title, description, type: z.enum([...7]), format: z.enum(["online","offline","self_paced"]),
  duration_hours: z.number(), mandatory: z.boolean(), target_roles: z.array(z.string()), target_grades: z.array(Grade),
  develops_skills: z.array(z.object({ skill_id, gain: z.number().int().min(0), max_level: z.number().int().min(0).max(5) })),
  prerequisites: SkillLevels, upcoming_sessions: z.array(z.string()) })
HistoryRow = z.object({ record_id, employee_id, event_id, date, due_date: z.string().optional().or(z.literal("")),
  status: z.enum(["completed","in_progress","dropped","no_show","declined","overdue"]),
  completion_pct: z.coerce.number().min(0).max(100), score: z.coerce.number().optional(),
  feedback_rating: z.coerce.number().int().min(1).max(5).optional(),
  assigned_by: z.enum(["self","manager","hr"]) })   // empty CSV cell → undefined before parse
```
Reference checks (in `import.ts`): the `role`/`grade` pair exists in role_profiles, every `skill_id` exists, and a history row's `event_id` and `employee_id` exist (the employee may be in the same upload). If a check fails, that row is rejected with `{file, row, field, message}`.

---

## 3. Domain contracts (`lib/contracts.ts`)

```ts
FactorKind = z.enum(["grade","skill_gap","next_level_requirement","participation_history",
                     "career_goal","session_availability","pending_gain","effort_fit"])
Factor = z.object({ kind: FactorKind, code: z.string() /* "F1".."F9" */, weight: z.number(),
  raw: z.number(), contribution: z.number(),
  values: z.record(z.string(), z.union([z.string(), z.number()])) /* e.g. {skill:"SK_SYSTEM_DESIGN", effective:3, required:4, target:"Senior"} */ })
GapRow = z.object({ skill_id, name, assessed: z.number(), effective: z.number(), required: z.number(),
  gap: z.number(), critical: z.boolean(), pendingFrom: z.array(z.object({event_id, date})) })
Trajectory = z.object({ current: {role, grade}, target: {role, grade, source: z.enum(["goal","next_grade","hold"])},
  gaps: z.array(GapRow), percentMet: z.number(), currentGradeGaps: z.array(GapRow) })
Recommendation = z.object({ event_id, title, type, format, duration_hours, next_session: z.string().nullable(),
  score: z.number(), factors: z.array(Factor) /* ≥3 distinct kinds, asserted */, 
  expected: z.array(z.object({ skill_id, from: z.number(), to: z.number(), max_level: z.number() })),
  rules: z.array(RuleTraceEntry) })
NoStepReason = z.enum(["AT_TOP_NO_GAP","NO_GAP_TO_NEXT","PREREQ_BLOCKED","NO_SESSION","CATALOGUE_GAP","ALL_DONE","DATA_INCOMPLETE"])
RecommendationResult = z.object({ employee_id, scoringVersion: z.literal("scoring.v1"), asOf: z.string(),
  recommendations: z.array(Recommendation).max(3), noStep: NoStepReason.nullable(),
  blocked: z.array(z.object({ event_id, title, failedRule: z.string(), detail: z.string() })) /* "available later" */ })
Explanation = z.object({ event_id, headline: z.string(), why: z.array(z.string()).min(3).max(5),
  expected_progress: z.string(), source: z.enum(["llm","template"]), fallbackReason: z.string().optional() })
ProgressResult = z.object({ event_id, changes: z.array(z.object({ skill_id, before, after, gain, max_level, capped: z.boolean() })),
  trajectoryBefore: Trajectory, trajectoryAfter: Trajectory, recommendations: RecommendationResult })
HrAggregates = z.object({ n: z.number(),
  laggingSkills: z.array(z.object({ skill_id, name, belowOwnGrade: Count, belowTarget: Count, criticalBelowTarget: Count })),
  noStep: z.array(z.object({ employee_id, full_name, role, grade, reason: NoStepReason })),
  participation: z.array(z.object({ event_id, title, mandatory: z.boolean(), byStatus: z.record(z.string(), Count), completionRate: z.number().nullable() })) })
Count = z.union([ z.number().int().min(5), z.object({ suppressed: z.literal(true) }) ])  // 0 is also shown; 1–4 is suppressed
ImportReport = z.object({ accepted: z.record(z.string(), z.number()), updated: z.record(z.string(), z.number()),
  errors: z.array(z.object({ file: z.string(), row: z.number(), field: z.string(), message: z.string() })) })
Session = z.discriminatedUnion("role", [ z.object({role: z.literal("employee"), employeeId: z.string()}),
                                          z.object({role: z.literal("hr"), id: z.literal("HR01")}) ])
```

The explanation is fetched separately from the recommendations, so R-10 holds: recommendations always come back fast, and the text loads after them.

---

## 4. API routes (all `withErrorHandling`; bodies via `parseBody`)

| Route | Method | Guard | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| `/api/session` | POST | none | `{role:"employee", employeeId} \| {role:"hr"}`. The id must exist in the dataset | `Session` + Set-Cookie | 400, 404 unknown id |
| `/api/session` | DELETE | none | — | `{ok:true}` | — |
| `/api/session` | GET | none | — | `Session \| null` | — |
| `/api/employees` | GET | none (login picker) | — | `[{employee_id, role, grade}]`. **No names, skills or history** | — |
| `/api/employees/[id]` | GET | self or HR (HR view audited with purpose `profile_view`) | — | `{employee: Employee, trajectory: Trajectory, history: HistoryRow[]}` | 401, 403, 404 |
| `/api/employees/[id]/recommendations` | GET | self or HR | — | `RecommendationResult` | 401, 403, 404 |
| `/api/employees/[id]/explanations` | POST | self or HR | `{event_ids: z.array(z.string()).min(1).max(3), locale: Locale}` | `{explanations: Explanation[]}`. **Always 200** (template fallback) | 401, 403, 404, 422 if an event_id is not in the current recs (the model cannot explain what the engine did not pick) |
| `/api/employees/[id]/complete` | POST | **self only** (HR on behalf: `actor.role=hr`, audited) | `{event_id}` | `ProgressResult` | 401, 403, 404, 409 `NOT_ELIGIBLE` (already completed / mandatory / unknown). Checked again server-side, whatever the client sent |
| `/api/employees/[id]/dismiss` | POST | self only | `{event_id}` | `RecommendationResult` | 401, 403, 404 |
| `/api/hr/aggregates` | GET | HR | — | `HrAggregates` | 401, 403 |
| `/api/hr/import` | POST | HR | `multipart/form-data`: any of `employees`, `activity_history`, `events`, `skills` (≤ 5 MB each). Parsed by zod after the file read. This is the one allowed non-JSON body and is documented | `ImportReport` (200 even when there are row errors) | 400 no files / unparsable JSON, 401, 403, 413 |
| `/api/health` | GET | none | — | existing | — |

Error envelope: the existing `ApiError` from `lib/http/validate.ts`. Codes: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `NOT_ELIGIBLE` 409, `VALIDATION` 400/422, `TOO_LARGE` 413. Page components call the same domain functions server-side, behind the same guards.

---

## 5. Agent / AI boundary

There is **one** AI call, `explain`. The model has no tools. Input: `{locale, event title, factors[], expected[]}`. It gets no history rows and no names. Output: the `Explanation` schema via `generateStructured`. Pipeline:
`engine picks → factors → prompt → generateStructured (8 s timeout, 2 attempts) → schema ok? → groundingCheck ok? → return llm text`. **Any** failure (timeout, provider down, junk, schema miss, an ungrounded number, < 3 factor kinds) → `templateExplanation`, with `source:"template"` and `fallbackReason`, and a trace step. The UI badges the text "AI" or "template" honestly. `MODEL_REF=mock:demo` → a scenario in `scenarios.ts` returns grounded text in the requested locale.

## 6. Security model
- Identity comes from the signed cookie only. A path `[id]` is never trusted: `requireEmployeeSelf` compares it with `session.employeeId`. HR is the only cross-employee reader. There are no leaderboard or rank routes (N-02).
- A guard runs before `getDataset()` is touched, so a missing or invalid session gives 401 (fails closed).
- `complete`, `dismiss`, `import`, and HR profile views each emit `recordAudit({actor, action, subject})`.
- Import: size cap, zod on every row, ids must match `^[A-Z0-9_]+$`. Nothing uploaded reaches the filesystem path or the prompt. Uploaded strings are rendered as text (React escaping).
- k ≥ 5 suppression is done in `hr.ts` (the server), not in the UI.

## 7. Observability (what the UI shows)
Per recommendation (`TraceView`): the rules passed/failed (the `RuleTraceEntry[]` from `evaluateRules`), a factor table (code, kind, values, weight × raw = contribution), total score, `scoringVersion`, and the tie-break used. Per explanation: source llm/template + fallbackReason. Per completion: skill before → after, `min(level + gain, max_level)`, and a capped flag. HR import: the report table.

## 8. Deployment
`docker compose up` (existing Dockerfile, `node:24-slim`, port 3000) is the single command. `pnpm start:demo` = build + start is the non-Docker path. Env: `MODEL_REF=mock:demo` (default), `DATASET_DIR` (optional), `DATA_DIR` (store), `SESSION_SECRET` (dev default, documented), `AS_OF_DATE` (optional). There is no Vercel deploy, because of N-06: the raw dataset must not go public.

## 9. Out of scope (explicit)
Real auth or SSO, the manager role and consent flow (the domain matrix row is documented, not built), the HR-lead approval of scoring config, enrolment/booking of sessions, the LLM choosing or re-ranking events, RAG/embeddings, gamification (O-02), the event builder (O-04), .ics (O-06), grade-transition simulation (O-01, only if time remains), events.json/skills.json replace via UI (the schema accepts them. It is tested only through the CLI unless time remains), concurrency safety in the store.

## 10. Complexity budget
Fully compliant. Storage is the existing file store plus an in-memory cache. There is no DB, ORM, migrations, queue, vector store, auth provider, GraphQL or second service. The only new code without a dependency is a ~40-line CSV parser, which avoids adding a package. The multipart upload uses `request.formData()` (built into Next), which is the single documented exception to `parseBody` for non-JSON bodies. Its fields are still zod-parsed.

## 11. Golden path (build first)
Log in as E0028 → `/employee/E0028` shows SD assessed 2 → effective 3 (EV_006, pending gain), critical vs Senior 4 → the top rec is an SD event, with ≥ 3 factors and a template or mock explanation → Complete → SD 3 → 4 appears in the before/after panel, and the recs refresh. Then HR login → `/hr` 3 panels → `/hr/import` uploads `data/fixtures/trap-*.json` → open T9001 and see the correct rec.
