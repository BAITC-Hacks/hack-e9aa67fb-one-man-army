# Requirements — Halyk Bank "Career Quest" (Case 1)

Source: `docs/task/halyk-career-quest-spec.txt` (EN section lines 228–340 are authoritative; RU 1–117 cross-checked) and `docs/task/career_quest_dataset/README.md`.
Last updated: 2026-09-23 ~13:40 Astana · Owner: `challenge-analyst`

Case 2 (Voice Router) is out of scope. The spec says "Cases are judged separately".

Ids are `R-NN` (mandatory), `I-NN` (implied), `N-NN` (negative, meaning prohibitions), `O-NN` (optional). Put the id in commit messages, test names and the README completion matrix.
Status values: `TODO` · `IN-PROGRESS` · `PASS` · `PARTIAL` · `DROPPED`

---

## 1. This Task's published criteria (read first)

Source: spec §10 "Deliverables". Weights are published explicitly, so there is no ASK-ORGANIZER item for this.

| Criterion (verbatim) | Points | What it actually rewards | Requirements that feed it |
| --- | --- | --- | --- |
| Compliance with the task and functionality: "how well the solution meets the assigned task and enables the main stated scenario to be implemented" | **25** | All 5 must-haves are demonstrable. The 3 jury trap profiles load and get correct multi-factor recommendations. The employee golden path runs end to end: profile → recommendation → complete → progress moves. | R-01…R-09, R-12, I-01…I-08 |
| Technical implementation: "selected approach, architecture, interaction between components, and use of AI/agentic AI … consistency of the actual implementation with the stated project logic" | **25** | A real multi-factor engine plus an AI layer that is real and bounded, and what the README claims matches the code. An LLM wrapper that just picks the lowest skill is the anti-pattern. | R-03, R-04, R-10, R-11, N-01, I-09 |
| README and reproducibility: "project structure, technologies, launch procedure, main operating scenario … reproducing and checking the solution" | **25** | Launch with a single command, no keys needed, a documented check procedure, and a documented upload format for jury profiles. | R-12, R-13, R-14, R-09 |
| Value and applicability: "how well the solution addresses the stated problem. Practical applicability" | **15** | It fixes the stated pain: employees see *why* a step matters and *where it leads*, and HR sees lagging skills and dropouts. It respects voluntariness and privacy. | R-04, R-06, N-02…N-05 |
| Development potential and originality: "further development … broader scale … well-founded unconventional or original approaches" | **10** | A path to scale (grade-transition modelling, HR event builder). Non-obvious signals such as pending gains after review, avoidance patterns and session availability. | O-01…O-06 |
| **Total** | **100** | | |

Operational inference (LIKELY): an AI judge reads the repo (see `docs/case-selection.md`). So README claims, test names and traces will be read literally.

---

## 2. The two elimination gates

| ID | Gate | Acceptance criterion | Verification | Status |
| --- | --- | --- | --- | --- |
| R-12 | Launches with a single command by following the README (spec §9 "Infrastructure: launch with a single command"; regs 5.4.16, 5.6.5) | From a clean clone, one documented command (e.g. `docker compose up` or `pnpm start:demo`) serves the app on a documented port, with dataset loaded, in ≤ 3 min | `bash scripts/clean-room-test.sh` passes | TODO |
| R-13 | Testable with no personal account (5.6.6) | The golden path, including recommendation text, works with only the committed `.env.example` (`MODEL_REF=mock:demo`), with no network or API key | clean-room run with network-off env; e2e test in mock mode | TODO |
| R-14 | README has all 8 elements (5.4.15) | Description/purpose · architecture · technologies · installation · startup · dependencies · env parameters · **procedure for checking the main scenario** (including how the jury uploads profiles and which employee id demonstrates the trap case) | `final-reviewer` checklist; grep headings | TODO |

---

## 3. Mandatory requirements

| ID | Source quote (EN spec) | Description | Acceptance criterion (pass/fail) | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| R-01 | "Profile and career trajectory — Open any employee — the role, grade, skills, completed activities and available next steps are visible." | Employee profile page for **any** loaded employee id | For every id in `employees.json` **and** in uploaded data, `/employee/:id` shows role, grade, tenure, all skills (missing = 0) against current and next-grade requirements, completed activities (from history, plus in-app completions), and the available next steps. Response ≤ 2 s. | Vitest: profile API for E0001, E0028 and an uploaded fixture. Playwright: open an E0028 profile | TODO |
| R-02 | "career trajectory" / "sees their profile and trajectory" | A trajectory, meaning current grade → next grade (or `career_goal`) and the gap per required skill | Page shows the target (goal if set, else next grade; Lead with no goal means holding Lead or the goal). It lists each required skill with current / required / gap, marks critical skills, and shows the % of requirements met | Unit test on the gap computation for E0028 (Senior target: SK_SYSTEM_DESIGN effective 3 vs 4, critical) | TODO |
| R-03 | "AI recommendation of the next step — The system suggests 1–3 relevant activities." | Recommend 1–3 **eligible, voluntary** events | Returns between 1 and 3 events, or 0 with an explicit "no suitable step" reason (feeds R-07). Every returned event passes the eligibility rules I-01…I-05. Returns within 10 s (mock mode: ≤ 2 s) | Vitest property test over all 200 employees: 0 ineligible recommendations, count ∈ [0,3], `mandatory` never recommended | TODO |
| R-04 | "The rationale relies on at least three factors — grade, skill gaps, participation history, next-level requirements" | Every recommendation carries a rationale citing **≥ 3 distinct factors** from that set, with concrete numbers | Each recommendation has a structured `factors[]` with ≥ 3 distinct kinds from {`grade`, `skill_gap`, `participation_history`, `next_level_requirement`} (plus optional `career_goal`, `session_availability`, `pending_gain`). Each factor includes values, e.g. "System Design 3 vs 4 required for Senior (critical)". The rendered text uses only facts present in `factors[]`. | Vitest: every rec for all 200 employees has ≥ 3 distinct factor kinds. An eval asserts no number in the LLM text is absent from the factors | TODO |
| R-05 | "Progress update — Mark an activity as completed — skill progress and the trajectory move" | Completing an event applies the dataset growth rule and updates the trajectory | POST complete for (employee, event): each `develops_skills` entry becomes `min(current + gain, max_level)`, and never decreases if current > max_level. It appends a `completed` history record, recalculates the gap and % to target, refreshes recommendations (the completed event disappears unless it is `EV_036`), and emits an audit event. UI shows before → after. | Vitest: E0028 completes EV_007 → SD 3→4 (max 4), COMM 4 stays 4 (max 4, no change). Playwright: click complete, the number moves | TODO |
| R-06 | "Simple HR view — Shows which skills lag most often, who has no recommended step, and participation by activity" | HR screen with three panels | (a) Skills ranked by the number of employees below the requirement for their own grade (and next grade), with counts. (b) A list of employees for whom the engine returns 0 recommendations, with a reason. (c) Per-event counts by status (completed / in_progress / dropped / no_show / declined / overdue) and a completion rate. Loads ≤ 2 s for 200+ employees | Vitest on the aggregation functions against the dataset. Playwright: HR page renders 3 panels | TODO |
| R-07 | "who has no recommended step" | The engine must be able to return "no step" and say why | For an employee with no eligible voluntary event (all completed, capped at max_level, prerequisites unmet, or none targeting role/grade), the result is `[]` plus a reason code, and that employee appears in HR panel (b) | Fixture F-05 (below) returns `[]` with a reason | TODO |
| R-08 | "The jury uses three profiles … designed so that a single-factor rule gets them wrong." | Recommendations must beat single-factor baselines on trap profiles | On fixtures F-01…F-04 the top recommendation differs from both "lowest skill" and "largest raw gap" baselines, and matches the expected event from the fixture file | Vitest: `trap-profiles.test.ts`, one assertion per fixture plus a baseline-differs assertion | TODO |
| R-09 | "The solution must be able to load additional profiles and history in the dataset format: at the defense, the jury uploads the test profiles." / README: "Evaluation uses additional employee profiles and history records in the same format." | Import additional `employees.json` (same `{meta, employees[]}` shape, or a bare array) and `activity_history.csv` (same columns) through the UI **and** the CLI/file-drop | Uploading a JSON with 3 new profiles plus a CSV with their history makes them openable at R-01 and recommendable at R-03 within 2 s, without a restart. Invalid rows produce field-level errors (zod) and valid rows still import. Also accepts events.json / skills.json replacement in the same schema (LIKELY not needed). Idempotent on duplicate `record_id` / `employee_id` (overwrite, reported) | Vitest: import fixture files. Playwright: upload flow. README documents both paths | TODO |
| R-10 | "Acceptable latency: interface response up to 2 seconds, AI recommendation up to 10 seconds." | Latency budgets | Non-AI endpoints p95 ≤ 2 s. The recommendation endpoint returns in ≤ 10 s including the LLM. On LLM timeout (hard 8 s) it falls back to a deterministic rationale template, so the response is never an error | Vitest timing test with mock provider plus timeout-fallback test | TODO |
| R-11 | "Explainability: it is visible why a step was suggested and how progress is calculated" | Show the scoring trace and the growth formula | Each recommendation has an expandable trace (factor scores and weights, rules passed/failed). The progress panel shows the formula `min(level + gain, max_level)` and which completion caused each change | Playwright: trace visible. Unit: trace present on every rec | TODO |
| R-15 | "Security: separation of employee/HR permissions" | Two roles, enforced server-side | An employee session can read and act only on its own profile (403 for another id, and for `/hr/*`). An HR session can read the aggregates and the per-employee list. The role check fails closed. Role switching in the demo is done with a demo login picker (no real accounts, R-13) | Vitest: API authz matrix (employee→other id = 403, employee→HR = 403, HR→HR = 200) | TODO |
| R-16 | "Privacy: internal loop; engagement data is not visible to other employees without consent" | No employee sees another employee's engagement data | No employee-facing endpoint returns another employee's history/skills. HR view is HR-only. Any peer-visible feature (if built) needs explicit opt-in, default off | Same authz test plus a grep test that employee routes never return foreign ids | TODO |
| R-17 | "Voluntariness: coercion is the main predictor of failure" | Recommendations are suggestions. The user may dismiss them, and nothing auto-enrols | Each recommendation has "not interested" / dismiss. Dismissing is recorded as a history signal and the next recommendation set excludes it. No auto-enrolment, no manager-push from the recommendation flow, and no negative UI language for dismissals | Vitest: dismiss excludes the event. Playwright: dismiss button present | TODO |
| R-18 | "The data is in English, with translations into Kazakh and Russian." + employees `preferred_language` kk/ru/en | UI and rationale language follow kk/ru/en | UI strings are i18n keys for kk/ru/en. The rationale is generated in the employee's `preferred_language` by default, with a language switch. (High-quality localisation is listed as *optional* in §8, so basic coverage is mandatory under repo rules and polish is optional) | Unit test: dictionaries have identical key sets. E0028 (kk) rationale renders in kk | TODO |

## 3a. Explicit prohibitions (negative requirements, spec §9)

| ID | Source quote | Acceptance criterion (a test fails if violated) | Verification |
| --- | --- | --- | --- |
| N-01 | "Not allowed: a recommendation based on a single profile field passed off as AI — the rationale must rely on several factors." | (a) Ranking uses ≥ 3 independent signals: removing any one signal changes at least one fixture's result (ablation test). (b) Rationale ≥ 3 factor kinds (R-04). (c) README honestly states which part is deterministic scoring and which part is LLM | Vitest ablation test on F-01…F-04. README review |
| N-02 | "Public employee performance rankings" | No page or endpoint lists employees ordered by skill/score/points/completions visible to employees. The HR "no recommended step" list is ordered alphabetically or by id, **not** by performance, and is HR-only. No leaderboards | Grep and route audit test: no `leaderboard` / `rank` routes. Playwright: employee pages contain no other employee names |
| N-03 | "Mechanics around mandatory processes, such as points for timesheets." | Events with `mandatory: true` (EV_001–EV_004) never earn points/badges/XP and are never recommended. Any gamification (optional) applies only to voluntary events | Vitest: gamification award function returns 0 for mandatory events. R-03 property test |
| N-04 | "Real personal data." | Only the synthetic dataset plus our own obviously fictional fixtures (names like "Test Trap-One", ids `T9001`+). No real IIN/phone/email | Fixture review. Grep for phone/IIN patterns in `data/` |
| N-05 | "coercion is the main predictor of failure" | No "mandatory"-style language, deadlines or manager-escalation on *recommended* voluntary events. Declines/no-shows are never shown to the employee as failures or to peers at all | UI copy review. i18n keys audit |
| N-06 | Spec §6 "the data is synthetic and may not be taken outside the hackathon" | Dataset is not pushed to any public location until the organizer answers Q1. Deployment (if any) is not public with raw data | See AMB-01 |

## 4. Implied requirements

| ID | Depends on | Description | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| I-01 | R-03 | **Audience eligibility** | Recommend only if `employee.role ∈ target_roles` AND `employee.grade ∈ target_grades` (see AMB-03 for next-grade events) | TODO |
| I-02 | R-03 | **Prerequisites** | Every `prerequisites[skill] ≤ effective_level(skill)`. Missing skill = 0. If unmet, not recommended, but it may appear as "unlocks after X" in the trajectory | TODO |
| I-03 | R-03 | **Not mandatory** | `mandatory: true` is never a recommendation target ("Assigned by HR. Not a recommendation target") | TODO |
| I-04 | R-03 | **No repeats** | Exclude events with any `completed` record for this employee, except `EV_036` (recurring club). Also exclude `in_progress` (already underway: show "continue" instead) | TODO |
| I-05 | R-03 | **Availability** | Non-`self_paced` events need ≥ 1 `upcoming_sessions` date ≥ snapshot `2026-10-01`. `self_paced` is always available. Show the next session date in the rec | TODO |
| I-06 | R-02, R-04 | **Effective skill level** | `effective = assessed level` + gains from `completed` events dated **after** `last_review_date` (README: "Activities completed after last_review_date are not yet included"), each applied with the growth rule in date order. Shown as "assessed 2 → effective 3 (EV_006 on 2026-09-08)". There are 202 such completions in the base data, so this is a common case, not an edge case | TODO |
| I-07 | R-04 | **Useful gain** | An event contributes to a gap only if `current < max_level` for that skill. Useful gain = `min(current+gain, max_level) − current`, capped at the target requirement. Events with 0 useful gain on every gap skill are ranked below all others or dropped | TODO |
| I-08 | R-04, R-08 | **Participation-history signal** | Per employee × (event and similar event), where similar = shares a developed skill or type/format: count `no_show`, `declined`, `dropped` (and `completion_pct`), `feedback_rating` ≤ 2 as negative engagement, and `completed` on time / high rating as positive. Repeated avoidance (≥ 2–3) of a skill's events lowers the score or switches to an alternative format (e.g. self_paced/online). The rationale states this explicitly ("you skipped 3 similar sessions; this one is self-paced") | TODO |
| I-09 | R-04, R-10 | **AI bounded**: the model proposes and code decides | Deterministic engine selects and scores the events. The LLM only writes the explanation (kk/ru/en) from the structured factors via `generateStructured`. It cannot add events that the engine did not return. Mock scenario in `lib/ai/scenarios.ts` | TODO |
| I-10 | R-09 | Schema validation of all four files (zod), including referential checks (event_id/skill_id exist; role/grade in role_profiles) | Invalid reference → row-level error, rest imported | TODO |
| I-11 | R-01 | "Today" is the dataset snapshot `2026-10-01` (`meta.as_of_date`), configurable, not the wall clock | Session availability and tenure calculations use `as_of_date` | TODO |
| I-12 | R-05 | Completion persistence survives restart (file-backed store) and `pnpm demo:reset` restores the base dataset | TODO |
| I-13 | R-06 | Lagging skill measured against each employee's **own current-grade** requirement and separately against **next grade** | TODO |

## 5. Optional (score only after all above PASS; spec §8)

| ID | Description | Feeds | Status |
| --- | --- | --- | --- |
| O-01 | Grade-transition modelling: "N steps / ~X hours to Senior", simulated plan of 3–5 events | Potential 10, Value 15 | TODO |
| O-02 | Voluntary-only gamification: progress bars / private badges for voluntary completions (no public ranking, N-02/N-03) | Value | TODO |
| O-03 | Extended HR dashboard: dropout risk list (declines/no_shows trend), by department | Value | TODO |
| O-04 | HR event builder (add an event in events.json schema) | Potential | TODO |
| O-05 | Polished kk/ru localisation | Value | TODO |
| O-06 | Calendar export (.ics) of the next session | Potential | TODO |

---

## 6. Data model summary (base dataset, verified 2026-09-23)

Snapshot "today" = **2026-10-01** (`meta.as_of_date` in every JSON). History window 2024-10-01 – 2026-09-30. All JSON files are `{ "meta": {...}, "<collection>": [...] }`.

### skills.json → `{meta, proficiency_scale, skills[60], role_profiles[32]}`
- `proficiency_scale`: `"0"`…`"5"` → text (0 None, 1 Basic, 2 Working, 3 Proficient, 4 Advanced, 5 Expert).
- `skills[]`: `skill_id` (`SK_*`), `name`, `type` `hard|soft`, `category`, `description`.
- `role_profiles[]`: `role` (8: Backend Engineer, Frontend Engineer, Data Analyst, QA Engineer, Product Manager, HR Business Partner, Sales Manager, Customer Support Specialist), `grade` `Junior<Middle<Senior<Lead`, `required_skills {skill_id: min_level}`, `critical_skills [skill_id]` ("must meet the requirement to hold this grade. Key for promotion"). Requirements never decrease with grade. Critical skills **change between grades**. Example, Backend: Junior [PYTHON] → Middle [PYTHON, API_DESIGN] → Senior [SYSTEM_DESIGN, API_DESIGN] → Lead [SYSTEM_DESIGN, LEADERSHIP, MENTORING].

### employees.json → `{meta, employees[200]}`
`employee_id` E0001…E0200 · `full_name` (synthetic) · `department` · `role`, `grade` · `manager_id` (Lead of same dept | null) · `hire_date` · `tenure_months` · `work_format` office|hybrid|remote · `preferred_language` kk(89)|ru(100)|en(11) · `career_goal` `{target_role, target_grade}` | null (66 null; 28 goals change **role**; 28 goals are the *same* grade, e.g. Middle→Middle in another role or "hold") · `skills {skill_id: 0–5}` (missing = 0) · `last_review_date`.
Grades: Junior 59, Middle 78, Senior 47, Lead 16 (Lead has no next grade).

### events.json → `{meta, events[40]}`
`event_id` EV_001…EV_040 · `title`, `description` · `type` compliance|onboarding|course|workshop|mentoring|certification|meetup · `format` online|offline|self_paced · `duration_hours` · `mandatory` bool · `target_roles[]`, `target_grades[]` · `develops_skills [{skill_id, gain, max_level}]` · `prerequisites {skill_id: min_level}` · `upcoming_sessions [date]` (empty iff self_paced; earliest 2026-10-05).
- Mandatory: EV_001–EV_003 (compliance, develop nothing), EV_004 onboarding (PRODUCT_KNOWLEDGE +1≤2, TEAMWORK +1≤2; done in the first month).
- All 72 `gain` values in the base data = **1**. Do not hard-code this, because jury data may differ.
- `max_level` varies (2–5) and often sits **below** the Senior/Lead requirement, e.g. EV_005 SD max 3, EV_007 SD max 4, EV_006 SD max 5. The cap is a real discriminator.
- Recurring: EV_036 (Public Speaking meetup, all roles/grades) can be repeated.
- Public-speaking events: EV_023 (DA/PM, offline), EV_031 (HRBP), EV_036 (all, offline). These are the likely "avoided" skill.

### activity_history.csv (2,743 rows)
`record_id, employee_id, event_id, date, due_date, status, completion_pct, score, feedback_rating, assigned_by`
- `status`: completed 2178 · no_show 195 · dropped 160 · declined 104 · overdue 90 · in_progress 16.
- `no_show`: scheduled events only (offline 101 / online 94), `completion_pct` 0. `declined`: refused an assignment from **manager/hr only** (never `self`). `overdue`: mandatory only, `due_date` set. `dropped`: 5–95%.
- `assigned_by` self|manager|hr. A self-initiated no_show is a weaker signal than a declined manager push. Both count as negative engagement.
- `score` only for course/certification/compliance. `feedback_rating` 1–5 optional.
- Sorted by date, employee_id, event_id.

### Growth rule (exact)
On `completed`: for each `{skill_id, gain, max_level}` in `develops_skills`: `new = max(current, min(current + gain, max_level))`. Never decreases. Missing skill starts at 0.

### Grade logic (derived)
- Target = `career_goal` if set (role may differ → use that role's profile), else the next grade in the same role. For a Lead with no goal, the target is holding Lead (current-grade gaps).
- Gap(skill) = `max(0, required[target][skill] − effective[skill])`. A critical gap (skill in the target's `critical_skills`) outranks a non-critical one.
- Also flag current-grade gaps (the person does not meet their own grade's critical skills). HR panel (a) uses these.

### Worked example: E0028 (matches the spec example)
Backend Engineer, Middle, 52 mo, no goal → target Senior. Assessed SD 2 (Senior requires 4, **critical**), PUBLIC_SPEAKING 2 (Senior requires 2, no gap), CLOUD 1 / CONTAINERS 1 / OBSERVABILITY 1 (low). `last_review_date` 2026-06-24, and EV_006 was completed on 2026-09-08 → **effective SD 3**, OBS 2, API stays 4. History: EV_007 no_show (manager) then completed (self). EV_009 (cloud) dropped **twice**. EV_010 (containers) dropped. So "lowest skill = Cloud 1" points to EV_009, which the employee abandoned twice, and the right step closes critical SD 3→4. EV_006 is already completed (not repeatable) and EV_007 is completed too. The engine must find the SD route among the eligible events remaining. The fixture expectation is derived by running rules, not by hand (see F-01).

---

## 7. Hidden-test analysis (the 3 jury trap profiles)

The spec's own example gives the pattern: *the lowest skill is X, but history shows X-type events were skipped ≥ 3 times, while skill Y is critical for the next grade*. The jury profiles are "designed so that a single-factor rule gets them wrong" and arrive **as new profiles plus history in dataset format**. Likely probes, each one breaking a specific single-factor rule:

| Probe | Single-factor rule it breaks | Factors the engine must combine |
| --- | --- | --- |
| P1 Lowest skill is repeatedly avoided (no_show/declined/dropped ×3); a critical next-grade skill has a gap | "lowest skill" | history + critical flag + next-level requirement |
| P2 Lowest skill is **not required** for the role/target grade (e.g. a Backend dev with DATA_VIZ 0) | "lowest skill", "largest gap" | role profile + next-level requirement |
| P3 The obvious event is ineligible: prerequisite unmet, wrong target_grade, already completed, in_progress, or `max_level` ≤ current | "match event to gap skill" | eligibility + growth-rule cap + prerequisites |
| P4 Assessment is stale: completion after `last_review_date` already closed the gap | "trust `skills` field" | history dates + growth rule |
| P5 `career_goal` targets a different role, so the gaps come from that role's profile | "next grade in same role" | career_goal + role profile |
| P6 Employee meets everything for the target, or everything eligible is done | "always return 3" | must return fewer or `[]` with a reason (R-07) |
| P7 Positive history: completed similar on time with high score → prefer continuing that path | "ignore history" | participation history (positive) |

**Recommender factors (all must be in the score and the trace):** target grade/goal requirements · critical flag · effective level (with pending gains) · useful gain under `max_level` · eligibility (role/grade/prereq/mandatory/completed/in_progress/sessions) · negative engagement by skill/type/format · positive engagement · session soonness / format fit (`work_format` remote → prefer online/self_paced).

### Adversarial fixtures to build ourselves (`data/fixtures/trap-*.json` + `.csv`, ids T9001+, obviously fictional names)

| Fixture | Profile | Expected behaviour | Beats |
| --- | --- | --- | --- |
| F-01 "Avoider" | Backend Middle, no goal. PUBLIC_SPEAKING 0 (lowest), SD 2. History: EV_036 no_show ×2 + declined ×1 (manager). EV_005 completed on time | Top rec closes SD toward 4 (EV_006 or EV_007, prereq SD 2 met). EV_036 **not** top, and the rationale cites 3 skips | lowest-skill |
| F-02 "Irrelevant zero" | Data Analyst Junior, goal Middle. SK_REACT 0 (not in profile), SQL 1 vs Middle requirement (critical per profile) | Rec targets a required/critical skill (e.g. EV_022 SQL). Never a Frontend event (wrong role) | lowest-skill, largest-raw-gap |
| F-03 "Stale review" | Backend Middle, last_review 2026-05-01, SD 3 assessed. EV_007 completed 2026-08 → effective SD 4 = Senior requirement | SD **not** recommended as a gap. Rationale mentions the pending gain. Next gap (e.g. OBSERVABILITY/CLOUD) chosen | trust-skills-field |
| F-04 "Capped / prereq" | Frontend Middle, TYPESCRIPT 2, WEB_PERFORMANCE 3, goal Senior. EV_014 needs TS 3 (unmet). EV_015 max 3 (no gain) | Recommends a TS step (EV_013: prereq JS 2, TS max 4) as the *unlock*. Not EV_014/EV_015 | naive skill→event match |
| F-05 "Nothing left" | Lead HR BP, no goal, meets all Lead requirements, and every eligible voluntary event is completed or capped | Returns `[]` + reason. Appears in HR "no recommended step" | always-return-3 |
| F-06 "Role switcher" (stretch) | QA Middle with goal `{Backend Engineer, Middle}` | Gaps come from the Backend Middle profile. Eligibility still uses the *current* role (AMB-04) | same-role assumption |

Expected results are asserted in `tests/trap-profiles.test.ts`. The ablation test (N-01) removes each factor and shows that at least one fixture flips.

---

## 8. Traceability matrix (planned components; the architect may rename)

| Req | Planned component | Test |
| --- | --- | --- |
| R-01, R-02, I-06, I-11 | `lib/domain/profile.ts` (effective levels, gaps, target), `app/employee/[id]` | `tests/profile.test.ts`, e2e `golden-path.spec.ts` |
| R-03, I-01…I-05, I-07 | `lib/rules/eligibility.ts` (Rule set via `evaluateRules`) | `tests/eligibility.test.ts` (property over 200 employees) |
| R-04, R-08, I-08, N-01 | `lib/rules/scoring.ts` (multi-factor score + trace), `lib/domain/recommend.ts` | `tests/trap-profiles.test.ts`, `tests/ablation.test.ts`, `tests/rationale-factors.test.ts` |
| R-05, I-12 | `lib/domain/progress.ts` (growth rule), `app/api/employees/[id]/complete` + `recordAudit`, file store | `tests/progress.test.ts`, e2e |
| R-06, R-07, I-13 | `lib/domain/hr-analytics.ts`, `app/hr` | `tests/hr-analytics.test.ts`, e2e `hr.spec.ts` |
| R-09, I-10 | `lib/data/schemas.ts` (zod), `lib/data/import.ts`, `app/api/import`, `app/hr/import` (UI), `pnpm data:import <dir>` | `tests/import.test.ts`, e2e `import.spec.ts` |
| R-10, I-09 | `lib/ai/explain.ts` via `generateStructured`, timeout fallback, `lib/ai/scenarios.ts` | `tests/explain.test.ts`, `pnpm eval` (no invented numbers) |
| R-11 | trace UI component, progress formula panel | e2e |
| R-15, R-16 | `lib/auth/session.ts` (demo role picker), route guards fail closed | `tests/authz.test.ts` |
| R-17 | dismiss endpoint + store | `tests/dismiss.test.ts` |
| R-18 | `lib/i18n/{kk,ru,en}.ts` | `tests/i18n-keys.test.ts` |
| N-02…N-05 | route audit, gamification guard | `tests/prohibitions.test.ts` |
| R-12…R-14 | `Dockerfile`/compose or `pnpm start:demo`, README | `scripts/clean-room-test.sh` |

---

## 9. Ambiguities and assumptions

| ID | Question | Class | Resolution / assumption |
| --- | --- | --- | --- |
| AMB-01 | May the starter kit be committed to our repo (BAITC-Hacks org)? Spec: "may not be taken outside the hackathon". R-12 needs the data to launch from a clean clone | **ASK-ORGANIZER** (was BLOCKING for R-12) | LIKELY allowed. Fallback, reversible: commit a same-schema **synthetic generator/seed subset** we authored, and load the official kit from `docs/task/career_quest_dataset/` if present. The README states both. Do not push the raw kit until answered |
| AMB-02 | Upload format at defense: which files (employees only? plus history? plus new events/skills?), JSON wrapper `{meta, employees}` or bare array, CSV encoding/delimiter, UI upload vs a folder in the repo? | **ASK-ORGANIZER** | Support all of these: wrapper or array, CSV with header, UI upload and CLI/drop folder, merge into the base dataset |
| AMB-03 | May we recommend events whose `target_grades` include the *next* grade but not the current one (e.g. EV_038 Senior/Lead for a Middle aiming at Senior)? The README says history always matches the "current or previous" grade | ASSUMPTION (LIKELY) | Only current-grade eligible. Next-grade events are shown in the trajectory as "unlocks at Senior", not recommended. Reversible via a flag |
| AMB-04 | For a `career_goal` in another role: eligibility by current role or target role? | ASSUMPTION (LIKELY) | Gaps from the target role profile. Eligibility by current role (`target_roles`) |
| AMB-05 | Should skills be recalculated from completions after `last_review_date`? | ASSUMPTION (LIKELY, strongly implied by README) | Yes, "effective level", shown separately from "assessed" |
| AMB-06 | Weight of `no_show`/`declined`/`dropped`; window (all 24 months vs recent) | ASSUMPTION | Recency-weighted counts over 24 months. ≥ 3 avoidances of a skill's events → strong penalty plus suggest an alternative format. Constants live in one rules file with the trace |
| AMB-07 | Does "AI recommendation" require an LLM to *choose*, or is deterministic selection + LLM explanation acceptable? | ASSUMPTION (LIKELY) | Deterministic selection + LLM explanation/re-ranking among engine candidates. The README states this plainly (protects "consistency with stated logic") |
| AMB-08 | Lead with no goal: what is "next step"? | ASSUMPTION | Hold-grade gaps (critical first), else growth beyond requirement where `max_level` allows, else `[]` |
| AMB-09 | Must HR be able to see individual engagement (who dropped out)? The spec asks for "who has no recommended step", while privacy covers *other employees* | ASSUMPTION (LIKELY) | HR sees individuals (role-gated). Employees never see others |
| AMB-10 | Is the jury running the app locally from README, or on our hosted URL? | ASK-ORGANIZER | Support both. Local single command is the primary path |

Assumption register (repo convention):
- VERIFIED: weights 25/25/25/15/10 (spec §10). Growth rule and statuses (README). All gains = 1 in base data. E0028 matches the spec example shape. Snapshot 2026-10-01. Mandatory = EV_001–EV_004. EV_036 is repeatable. 202 completions post-date the review.
- LIKELY: AMB-01 allowed, AMB-03, AMB-04, AMB-05, AMB-07, AMB-09. An AI judge reads the repo.
- UNKNOWN: AMB-02 exact upload format. AMB-10 how the jury runs it. Whether jury profiles introduce new roles/skills/events.
- BLOCKING: none for architecture. AMB-01 blocks only *committing the raw data*, and the generator fallback removes the block.

## 10. Hidden constraints found

| Constraint | Source quote | Impact |
| --- | --- | --- |
| Jury uploads profiles live | "at the defense, the jury uploads the test profiles" | R-09 must work through the UI with no restart. Rehearse it |
| Snapshot date ≠ wall clock | README "Snapshot date: 2026-10-01. Treat it as 'today'." | I-11. Using `new Date()` breaks session availability |
| Stale assessments | "Activities completed after last_review_date are not yet included." | I-06, a likely trap |
| Mandatory not a target | "Assigned by HR. Not a recommendation target" | I-03, N-03 |
| No repeats except EV_036 | README Rules | I-04 |
| Latency | "interface response up to 2 seconds, AI recommendation up to 10 seconds" | R-10. LLM timeout plus fallback |
| Single command | "Infrastructure: launch with a single command" | R-12 |
| Core is recommendation quality, not UI | "The core of the task is the quality and explainability of the recommendation, not the interface wrapping. Gamification is an add-on" | Scope ladder: cut UI polish and gamification first |
| Data residency | "may not be taken outside the hackathon" | N-06, AMB-01 |

## 11. Scope ladder (cut from the top first)

1. O-04 event builder, O-06 calendar
2. O-02 gamification
3. O-03 extended HR dashboard, O-01 transition modelling
4. O-05 localisation polish (keep the key sets)
5. R-17 dismiss persistence (keep the button + in-session exclusion). This is the last thing to degrade.
Never cut: R-01…R-12, R-15, N-01…N-04, I-01…I-08.
