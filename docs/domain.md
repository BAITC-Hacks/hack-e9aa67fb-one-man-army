# Domain model — Halyk Career Quest

Tags: `VERIFIED` = quoted or derived directly from the spec (`docs/task/halyk-career-quest-spec.txt` L255–331) or the dataset README. `LIKELY` = standard L&D / HR-tech practice, no source. `UNKNOWN` = a design guess. Only VERIFIED items may be stated as fact in the README.

This is an internal HR product, not a customer-money product. The finance-domain rules still apply: **the model does not decide, the numbers come from code, and when the system is unsure it sends the case to a human instead of guessing.**

---

## 0. The real workflow

**Today** (VERIFIED, spec L239, L257): HR events arrive as separate notifications with deadlines. The employee cannot see where they lead. Training gets done as a formality on the deadline day, and turnout for voluntary activities is low, even though the development budget is fully spent.

**Where the data lives today** (LIKELY): an LMS holds enrolments and completions, a performance/HRIS system holds grades and skill assessments, and a spreadsheet holds the competency matrix. The dataset flattens these into four files.

**Target workflow:** for one employee, a deterministic engine chooses 1–3 eligible voluntary development steps that close gaps to the next grade. An LLM explains the engine's factor trace in the employee's language. Completing an activity moves projected skill levels by the gain rules in the dataset. HR sees lagging competencies in aggregate, plus who has no step.

---

## 1. Actors and permission matrix

### Actors

| Actor | Source in data | Authority |
|---|---|---|
| **Employee** | `employees.json` row | Sees and acts on their own record only. The only actor who can enrol themselves in a voluntary step. |
| **Line manager / department head** | `manager_id` (a Lead); `manager_id = null` means department head (VERIFIED, dataset README) | Sees team aggregates. Sees an individual's detail only with that employee's consent. Cannot enrol anyone in a voluntary step. |
| **HR specialist** | none in data; demo role | Sees org aggregates and the "no recommended step" list. Can open an individual profile for a stated purpose, and every such view is audited. Owns the event catalogue and scoring config. |
| **HR lead (second pair of eyes)** | demo role, UNKNOWN whether Halyk has one | Approves changes to scoring weights / config versions. One HR user cannot both change the weights and publish them. |
| **System (rules engine)** | code | Decides eligibility, computes skill arithmetic and ranks. The only actor that writes projected skill levels. |
| **AI (LLM)** | `generateStructured` | No authority. Turns an existing factor trace into prose and translates it (kk/ru/en). Never adds, removes or reorders steps. |

Spec anchors (VERIFIED): "engagement data is not visible to other employees without consent"; "separation of employee/HR permissions"; "Public employee performance rankings" are not allowed.

**Engagement data** means `activity_history` rows: statuses, `no_show`, `declined`, `dropped`, `score`, `feedback_rating`, `assigned_by`. It is the most sensitive field set here. Skill levels come from assessments and are somewhat less sensitive, but are still personal.

### Permission matrix (fail-closed: any cell not listed is DENY)

| Resource / action | Employee (self) | Employee (other) | Manager / Dept head | HR specialist | HR lead | AI |
|---|---|---|---|---|---|---|
| Own profile, skills, trajectory | R | DENY | consent → R | R (audited) | R (audited) | trace only |
| Own recommendations + rationale | R | DENY | consent → R | R (audited) | R (audited) | phrase only |
| Engagement history (no-show/declined/score/feedback) | R | DENY | DENY (aggregate only) | R (audited, purpose-bound) | R (audited) | factor summary only, no raw rows |
| Enrol in a voluntary step | W (self only) | DENY | DENY (may *suggest*, which the employee sees as a suggestion) | DENY | DENY | DENY |
| Mark own activity completed (demo) | W | DENY | DENY | W (on behalf, audited): LIKELY, real LMS feed replaces this | W | DENY |
| Decline / hide a recommendation | W, no reason required | DENY | DENY | DENY | DENY | DENY |
| Grant / revoke consent to manager | W | DENY | DENY | DENY | DENY | DENY |
| Team aggregates (own dept) | DENY | DENY | R, k ≥ 5 | R | R | DENY |
| Org aggregates, lagging skills | DENY | DENY | DENY | R, k ≥ 5 | R | DENY |
| "No recommended step" list (names) | DENY | DENY | DENY (count only) | R (audited) | R | DENY |
| Upload profiles / history (dataset format) | DENY | DENY | DENY | W (validated, audited) | W | DENY |
| Edit scoring config | DENY | DENY | DENY | propose | approve + publish | DENY |
| Any ranking of employees against each other | DENY for everyone, because it does not exist as a view (spec L302) | | | | | |

Implementation notes:
- The demo uses a role switcher. The README must say so honestly (VERIFIED requirement: no personal accounts needed). Every request still resolves `actor → role → allowed scope` on the server, and the scope check runs before any data is loaded.
- HR individual-view "purpose" can be a fixed enum (`no_step_followup`, `data_correction`). It goes into `recordAudit`. (LIKELY)

---

## 2. Core workflow — who proposes, who decides

```
[1] Employee opens profile                    CODE: load, compute effective skills
[2] Trajectory: current grade → next grade    CODE: gap table vs role_profiles
[3] Candidate filter (hard gates)             CODE: eligibility rules, each with a trace
[4] Score + rank, pick top 1–3                CODE: weighted factors, versioned config
[5] Rationale text                            AI:   phrases the trace; validated against it
[6] Employee enrols (voluntary, optional)     EMPLOYEE decides; CODE records + audits
[7] Complete → progress update                CODE: min(level + gain, max_level)
[8] Re-rank                                   CODE: back to [3]
[9] HR aggregate view                         CODE: aggregates with k-anonymity
```

### [1] Effective skill level (CODE)
The README says (VERIFIED): "Skill levels reflect the last assessment. Activities completed after `last_review_date` are not yet included." So:

`effective[s] = assessed[s]`, then apply, in date order, every `completed` history row dated after `last_review_date`:
`effective[s] = min(effective[s] + gain, max_level)`, but only if `effective[s] < max_level`.

The UI shows both numbers, "assessed 2 · projected 3". Projected levels are **not** a certified assessment (LIKELY). Grade readiness is always labelled "projected" until a review confirms it. This is the honest version of "progress moved".

### [2] Target grade (CODE)
- Default: the next grade in `Junior → Middle → Senior → Lead` for the same role (VERIFIED order).
- If `career_goal` is set: use `role_profiles[target_role, target_grade]` as the target. Skills the goal and the next grade share get the higher of the two weights. (UNKNOWN: whether the goal should replace the next grade or add to it. Recommend *add*, showing the next-grade gaps first.)
- At **Lead** with no goal: target = current-grade requirements, which keeps the grade held (critical skills "must meet the requirement to hold this grade", VERIFIED). If there are no gaps there either, the result is `NO_STEP: AT_TOP_NO_GAP`.

Gap table: `gap[s] = max(0, required[s] − effective[s])`, with `critical[s]` flagged.

### [3] Hard gates — each is a `Rule` with a pass/fail trace (CODE)
| Rule | Source |
|---|---|
| `mandatory === false`, because mandatory events are not a recommendation target | VERIFIED |
| Employee role ∈ `target_roles` and next-or-current grade ∈ `target_grades` | VERIFIED fields; allowing next grade is LIKELY |
| All `prerequisites` met on **effective** skills | VERIFIED |
| Not already `completed` (except `EV_036`, recurring) | VERIFIED |
| Not currently `in_progress` | LIKELY |
| Has an `upcoming_session` after snapshot `2026-10-01`, or `format = self_paced` | VERIFIED fields |
| Develops ≥ 1 target skill with `gap > 0` and `effective < max_level` (real headroom) | VERIFIED arithmetic |
| Employee has not hidden this event ("not for me") | design |

A candidate that fails a gate is **not shown as a recommendation**. The profile does show it under "available later", with the failing value named: "Needs SK_SQL ≥ 3, you have 2". That is the "decline reason a human can act on" rule, applied to eligibility.

### [5] AI rationale (AI proposes text, CODE validates)
- Input: the structured trace only (factor names, numbers, event ids). No raw history rows, no names of other people.
- Output schema: `{event_id, headline, why[], expected_progress}`. Validation rejects the output if any `event_id`, skill id or number is not in the trace, and uses a deterministic template in its place. The template is also the `mock:demo` output.
- It must name at least 3 factors (VERIFIED must-have: "at least three factors — grade, skill gaps, participation history, next-level requirements").
- The latency limit is 10 s for the AI recommendation (VERIFIED). The template renders immediately and the LLM text replaces it when it arrives.

---

## 3. Scoring model

Principle: **a critical gap to the next grade matters most, and history changes *how* we close it, not *whether* we do.** This is exactly the jury's example (VERIFIED, spec L299): the lowest skill is Public Speaking, but there are 3 skips of similar activities and System Design is critical for the next grade. A "pick the lowest skill" rule gets it wrong.

### Factors (all computed per candidate event `e`, per employee)

| # | Factor | Computation | Weight (config v1, UNKNOWN, tune on fixtures) |
|---|---|---|---|
| F1 | **Critical gap closure** | Σ over e's skills that are critical at target: `min(gain, gap, max_level − effective)` | ×3 |
| F2 | **Non-critical gap closure** | same, for non-critical required skills | ×1 |
| F3 | **Gap severity** | the largest `gap` among skills e closes (a 2-level gap beats a 1-level one) | ×1 |
| F4 | **Career-goal alignment** | +1 if e closes a gap to `career_goal` target that is not already counted | ×1 |
| F5 | **Participation fit (penalty)** | count of `no_show` + `declined` + `dropped` in last 12 months on **similar** events (same `type`+`format`, or same primary skill) | −1.5 per record, capped at −4.5 |
| F6 | **Format switch bonus** | if F5 fired for a format, +1 for a candidate developing the *same* skill in a *different* format (e.g. offline workshop no-shows → self-paced or mentoring) | +1 |
| F7 | **Reliability signal** | employee's on-time completion rate on voluntary (`assigned_by = self`) events of this type | ×0.5 (shown in rationale: "your last two were completed on time") |
| F8 | **Effort fit** | small penalty if `duration_hours` is far above the employee's median completed duration | −0.5 |
| F9 | **Timeliness** | nearest session within 30 days, or self-paced | +0.5 |

`score(e) = Σ weight × factor`. Integer/half-point arithmetic only. Weights live in a **versioned config** (`scoring.v1`), and the version is stamped on every trace. Ties are broken by F1, then shorter duration, then `event_id`, so the result is deterministic.

Selection:
- Sort, take top 3, apply a **diversity rule**: no two steps that close only the same skill. The second slot goes to the next-best distinct skill (LIKELY good L&D practice: a 70/20/10-style mix of course, practice and mentoring).
- Return fewer than 3 if fewer clear a minimum score (> 0). Never pad the list with irrelevant steps.

Why history is a penalty and not an exclusion (LIKELY): three no-shows on offline speaking workshops say the *format* or timing fails for this person. They do not say the skill is irrelevant. Excluding the skill forever would hide a real gap. The rationale says this plainly and without judgement: "offered as self-paced because in-person sessions didn't fit your schedule before". Never "because you skipped 3 times".

Also: history rows with `assigned_by ∈ {manager, hr}` and status `declined` are a weaker signal than self-enrolled no-shows (UNKNOWN weighting; recommend ×0.5). Declining an imposed activity is not disengagement.

### "No recommended step" (the HR list, VERIFIED must-have)
Every employee with an empty result gets exactly one reason code, computed by code:

| Code | Meaning | Suggested HR action (LIKELY) |
|---|---|---|
| `AT_TOP_NO_GAP` | Lead, no goal, all current requirements met | career conversation, goal setting |
| `NO_GAP_TO_NEXT` | meets next-grade requirements already | promotion-readiness review (human) |
| `PREREQ_BLOCKED` | gaps exist, but every relevant event needs a prerequisite they lack | foundation event missing from catalogue |
| `NO_SESSION` | relevant events exist, none scheduled | schedule a session |
| `CATALOGUE_GAP` | a critical skill has a gap and no event develops it for this role | build or buy content |
| `DATA_INCOMPLETE` | profile fails validation (unknown role/grade, missing skills map) | fix the data, since the engine will not guess |

A malformed or partially loaded profile is marked `DATA_INCOMPLETE` and sent to HR. The system never invents a recommendation from partial data.

---

## 4. HR view — useful and privacy-safe

VERIFIED must-have: "which skills lag most often, who has no recommended step, and participation by activity".

| Panel | Metric | Privacy |
|---|---|---|
| **Lagging skills** | per skill: count and % of employees with `gap > 0` to next grade, split critical vs non-critical; filter by department/role/grade | cells with n < 5 are suppressed ("<5") (k-anonymity, LIKELY threshold) |
| **No recommended step** | count by reason code; HR drills into names | names visible to HR only, audited; managers see counts |
| **Participation by activity** | per event: enrolled, completed, no-show, declined, dropped, completion rate, avg feedback; split `self` vs `manager/hr`-assigned | event-level, not person-level; suppress n < 5 |
| **Catalogue coverage** | critical skills with no voluntary event per role | no personal data |
| **Voluntary vs assigned completion** | completion rate, self-enrolled vs assigned | aggregate; the key value chart (§5) |

Not built, deliberately: any per-person leaderboard, "top learners", or manager-facing list of who no-showed. The spec rules out public rankings (VERIFIED), and a manager list of no-shows is exactly the "engagement data visible without consent" case.

With 200 employees across 8 roles × 4 grades, some role×grade cells will fall below 5. Show suppression visibly so a judge sees the control working.

---

## 5. Outcome measure (for "Value and applicability", 15 pts)

**Headline number: share of employees with at least one eligible voluntary step that closes a critical next-grade gap** ("critical-gap coverage"). It is fully computable on the dataset. Pair it with:

- **Baseline voluntary completion rate** from history: `completed / (completed + no_show + dropped + declined)` for `assigned_by = self`, compared against manager/hr-assigned. Computed from the dataset, not invented. If self-enrolled beats assigned, that supports the voluntariness design. If it does not, report that too.
- **Projected grade readiness:** the number of employees who would meet all *critical* skills of the next grade after completing their recommended steps. This is a deterministic projection from the gain arithmetic, **labelled as a projection**, not an outcome.
- **Rationale quality:** % of recommendations whose rationale cites ≥ 3 factors (should be 100%, checked by test), and **single-factor disagreement**: on how many profiles our top pick differs from "lowest skill". Shows the engine is multi-factor on real data.

Honest demo framing: "On the synthetic dataset, X of 200 employees had no step that closes a critical gap. After the engine, Y do". Here X is the baseline "an employee picking from the catalogue by role/grade only" and Y comes from our gates. Never claim a completion uplift. We have no post-intervention data, so any uplift figure would be fabricated.

Pain served: **mainly the employee** (seeing why a step matters and where it leads). The operator side (HR) is served by the lagging-skill and no-step views.

---

## 6. Voluntariness and anti-coercion design points

"Coercion is the main predictor of failure for such programs" (VERIFIED).

Do:
- Every recommendation has **Enrol**, **Not now** and **Not for me** buttons. Hiding needs no reason, has no penalty and is not shown to the manager.
- Mandatory events appear only in a separate "Assigned to you" area, with no points or gamification (VERIFIED: no mechanics around mandatory processes). They are never mixed into the recommendations.
- Progress is compared **only with the employee's own past and their target grade** ("2 of 4 critical skills ready"), never with colleagues.
- Rationale wording about history is neutral and future-focused ("a format that may fit better").
- Consent to share progress with the manager is an explicit toggle, off by default, and can be revoked.
- A manager can *suggest* a step. It shows as "suggested by your manager" and can be declined like any other.

Red flags a judge would read as dark patterns (avoid):
- Streaks or "you're falling behind" nudges, countdown timers, loss-framed notifications.
- A pre-checked enrol box, or "Not for me" hidden behind a menu.
- Showing percentile, "top 10% of your department", or any cross-employee comparison.
- Telling the employee "HR can see you declined".
- Points for completing compliance training or timesheets.
- Showing "projected" skill levels as if they were certified, or implying promotion is guaranteed. Grade decisions stay with humans (LIKELY). The app states readiness, not entitlement.

---

## Assumptions register

| Tag | Count | Items |
|---|---|---|
| VERIFIED | 16 | spec must-haves (5), jury trap profile, no rankings, no mandatory mechanics, privacy consent, employee/HR separation, voluntariness, latency 2 s/10 s, gain/max_level rule, mandatory not a target, critical_skills semantics, last_review_date rule |
| LIKELY | 11 | effective-level projection, k = 5, history as penalty not exclusion, allowing next-grade target events, diversity rule, format-switch bonus, imposed-decline down-weighting, HR purpose-bound access, promotion stays human, demo role switcher acceptable, self-vs-assigned completion as value metric |
| UNKNOWN | 5 | all weights in `scoring.v1`, career goal adds vs replaces, 12-month lookback, HR lead approver exists at Halyk, similarity definition (type+format vs primary skill) |

**UNVERIFIED-RISK:** we have not seen the jury's three test profiles. The weights (UNKNOWN) could still rank the trap case wrong: for example, a small critical gap vs a large non-critical gap plus a history penalty. Mitigation: build 3+ adversarial fixtures modelled on spec L299 before tuning, and lock them as tests. Also, the effective-level projection must be applied, or an employee's recent completions will be recommended again.
