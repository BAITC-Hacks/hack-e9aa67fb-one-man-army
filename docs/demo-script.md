# Demo script — Career Quest (Halyk Bank, Case 1)

5-minute live run + defense runbook, for a solo operator. Exact clicks, exact UI
strings (from `lib/i18n/dict.ts`, `en`), timestamps assume a 5:00 slot.

## 0. Pre-demo checklist (do this before the jury sits down)

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm install --frozen-lockfile
pnpm build
pnpm start &            # http://localhost:3000, background
curl -s http://localhost:3000/api/health   # expect model.ref "mock:demo", offline:true
```

- `pnpm demo:reset` exists (`node scripts/demo.mjs reset`) — run it if any prior
  session left completions/dismissals in `data/`. `pnpm demo:seed` (re)writes the
  committed demo overlays; neither is required for a first clean clone.
- Open `http://localhost:3000/login` in the browser, confirm it loads (no key,
  no password — "Pick a demo identity").
- Click the language switch once (kk → ru → en) to prove it's live, then leave
  it on **ru** (the default) for the timed run.
- Kill only this PID after: `kill %1` (or `lsof -ti:3000 | xargs kill`).

## 1. The script (5:00)

**0:00–0:20 — Problem, one sentence.** "Today, development activities arrive
as separate HR notifications with deadlines; the employee can't see where a
step leads, so training gets done as a formality and voluntary turnout stays
low even though the budget is spent — and coercion is the named cause."

**0:20–1:10 — E0137's profile: effective vs assessed skill.** `/login` →
"I am an employee" → pick **E0137** (Backend Engineer, Middle → Senior) →
"Continue as employee". On the profile, point at System Design: gap to the
Senior requirement, flagged critical.

**1:10–2:20 — 3 cards + "Why this step".** Point at the 3 recommendation
cards: `EV_006` "Designing High-Load Systems" (offline, score 8, closes 2
critical levels: System Design 2→3 and API Design 3→4, plus Observability
2→3); `EV_009` "Cloud Certification Prep" (self-paced, 6.5); `EV_007`
"Architecture Review Circle" (online, 6, closes the same critical System
Design gap). Click **"Why this step"** on card 1 to expand the trace and
read the grounded rationale out loud, and the source badge under it: **"Demo
model (offline, not a live AI)"** — say plainly that this badge is honest:
`MODEL_REF=mock:demo` by default, so the rationale text is a scripted echo
of the same factor trace, not a live model call. Optional honest aside: card
1 is an event E0137 previously no-showed; the rationale itself says a
skipped/no-show record was weighed, and it is still the top-ranked card.

**2:20–3:00 — Format-switch signal.** Point at card 3, `EV_007`: it is
flagged inline as a **format switch** — E0137 skipped a similar offline
session before, so this event is offered online instead. Say this is a
deterministic scoring factor, computed from `activity_history` no-show/
dropped counts, not modelled by the LLM.

**3:00–3:30 — Mark complete.** Click **"Mark complete"** on card 1
(`EV_006`). Say what actually happens: System Design moves to 3, API Design
to 4, Observability to 3 (capped at `max_level`); `EV_006` drops out of the
recommendation list. Point at the list re-ranking to `EV_009` (6.5) and
`EV_007` (5, still closing the critical System Design 3→4 gap) — the
highest-scoring remaining card takes the top slot.

**Optional +30s insert (time-permitting, before "Mark complete") — AI
suggestions for a no-step employee.** Log in
as **E0065** (`PREREQ_BLOCKED`, no catalogue step). Point at the "AI
suggestions — not in the catalogue" card: violet dashed border, "AI-generated"
badge per item, a caution line, and the source badge (`llm`/`mock`/`template`)
— say plainly this is labelled distinctly from a catalogue recommendation and
never creates or changes one. Data: `docs/live-runs/suggestions.md`.

**3:30–3:50 — Path to next grade (voluntary).** Scroll to the grade-path
panel: "A voluntary plan — not a requirement or a deadline." Any gap no
catalogue event can close is shown honestly under "Gaps nothing in the
catalogue closes yet", not hidden.

**3:50–4:40 — HR view.** Log out → `/login` → "I am from HR" → "Continue as
HR" → `/hr`. Walk the three panels: **Lagging skills** (below own grade /
below target / critical & below target, with cells under 5 employees shown as
"Hidden (fewer than 5 employees)"); **Employees with no recommended step**
(each row carries a reason code, e.g. `LOW_FIT`, `ALL_DONE` — "Listed by
employee id, not ranked"); **Participation by activity** (status counts +
completion rate per event, mandatory vs optional).

**4:40–5:00 — HR import of a trap profile.** Click **"Upload activity data"**
(`/hr/import`) → upload `data/fixtures/trap-F01.json` (employees) and
`data/fixtures/trap-F01.csv` (activity_history) → show the per-row report,
zero errors → log in as **T9001** → profile and recommendations appear
immediately, no restart.

## 2. Defense: the jury upload

- **Where:** `/hr/import`, HR role only (fails closed for the employee role).
- **Formats accepted:** `employees.json` (`{meta, employees[]}` or a bare
  array) and `activity_history.csv` (same columns as the base dataset). Also
  accepts `skills.json`/`events.json` overlays in the same schema, including
  `role_profiles` rows.
- **What the per-row report shows:** accepted count, updated count (overwrite
  on duplicate id, reported), and a per-row error table (file, row, field,
  message) for anything zod rejects — the rest of the file still imports.
- **Errors mean:** a field failed schema or reference validation (e.g. an
  `event_id` or `skill_id` that doesn't exist) — that row is skipped, nothing
  else is.
- **If their file has a new role or event:** an uploaded `role_profiles` row
  is merged into `skills.json`'s in-memory overlay, keyed `role::grade`, and
  is consulted by eligibility immediately — not just stored inert.
- **Fallback if upload is flaky live:** set `DATASET_DIR` to a folder holding
  the jury's files in the same shape as `docs/task/career_quest_dataset/` and
  restart — same schema, no code change, documented in README §11.

## 3. Likely jury questions

- **"Why deterministic engine + LLM, not an LLM agent end to end?"** Because
  eligibility, scoring and skill arithmetic have legal/financial-adjacent
  consequence for a person's grade path — those are `Rule`s in `lib/rules/`
  with a recorded trace. The model only writes rationale prose from the
  engine's own factor list and is rejected if it names a number, skill or
  event the engine didn't produce (`lib/ai/grounding.ts`).
- **"How do you defeat a single-factor trap?"** The score sums ≥3 independent
  factor kinds (grade, skill gap, participation history, next-level
  requirement); the trap fixtures (`data/fixtures/trap-F01..F05`) assert the
  top pick differs from both a "lowest skill" and a "largest raw gap"
  baseline.
- **"How is privacy protected? No rankings?"** No route lists employees by
  score; employee sessions can't read another employee's data; HR aggregate
  cells under 5 employees are suppressed, not just hidden client-side.
- **"Is anything mandatory or coerced?"** No — every recommendation is
  voluntary; there's a dismiss action ("Not useful for me") with no penalty
  and no manager visibility of the decline.
- **"How would this scale bank-wide?"** File-backed store today; the README's
  scalability table names the concrete swap points (Postgres past ~200
  employees or concurrent writes, real SSO behind the existing session
  contract, a manager-consent role already documented but not built).
- **"What isn't done?"** From README §19: HR aggregate views aren't audited
  yet (individual profile views are); no dedicated p95 latency benchmark for
  R-10 (the timeout/fallback itself is tested); real SSO, manager-consent
  role, HR scoring-config approval, session booking, and write-concurrency
  safety in the file store are out of scope by design for a single-instance
  demo.
