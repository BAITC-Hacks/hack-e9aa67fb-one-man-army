> **Historical snapshot.** This is an internal mid-build review written during the competition. The findings listed here were addressed in later commits (see `git log`); the current state is described in `README.md` and `docs/EVALUATION_GUIDE.md`.

# Final review, about 15:35 Astana (HEAD 3535294)

This review assumes every claim is unproven until it is executed. Every row below was either run or read in code during this review. The only file changed is this one.

## What was run

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm test` | 16 files, **101 tests, all pass** |
| `pnpm eval` | **9/9 pass** (grounding, hallucination rejection, factor coverage, en/ru/kk, injection, no-ranking, trap F-01) |
| `CLEAN_ROOM_PORT=3291 bash scripts/clean-room-test.sh` | **PASS**, 8/8 steps, health reports `mock:demo`, `offline:true`, and the port was released |
| Following the README literally: `git clone` into scratch → `cp .env.example .env` → `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm build` → `PORT=3292 pnpm start` | works |
| `CI=1 pnpm test:e2e`, run in the clean clone | **5/5 pass** (golden path, source badge, cross-employee denial, HR import) |
| Live: E0028 recommendations | EV_037 Mentor Track (score 3), EV_036 Public Speaking Club (1.5), EV_008 Business Writing (1.5) |
| Live: EV_037 explanation, `ru` | 3 human-readable sentences, `source:"mock"` — matches README §5 |
| Live: EV_036 and EV_008 explanations | **`source:"template"`, `fallbackReason:"grounding_failed: Only 1 distinct factor kind(s)…"`**. The text is "…graded Middle… / A session is scheduled soon… / This addresses Public Speaking Club." |
| Live: complete EV_037 | Mentoring 2→3 and Feedback 2→3. **System Design does not move.** |
| Live: E0028 → E0001 recs, E0028 → `/api/hr/aggregates`, POST with `Origin: http://evil.example` | 403 / 403 / 403 (correct) |
| Live: HR imports `data/fixtures/trap-F01`, `F03`, `F06` (json + csv) on the kit | 0 errors each. T9001, T9003 and T9006 then get 3 multi-factor recommendations each. T9001's top pick is EV_006 (System Design), not the Public Speaking event they avoid |
| Live: `/api/employees/E0028/grade-path` | steps: **EV_009 (dropped twice by E0028), EV_010 (dropped)**, EV_037 |
| `gh repo view` | PRIVATE, in the BAITC-Hacks org. Committing the kit does not take the data outside the hackathon |

## Elimination gates

| Gate | Status |
| --- | --- |
| Launches by following the README from a clean clone | **PASS**: clean-room plus a literal README run |
| Key functionality works with no personal account | **PASS**: `mock:demo` default, demo login picker, no `.env` needed beyond the example |
| README has all 8 elements (5.4.15), including the check procedure | **PASS**: §2, §6, §9, §10, §10/§12, §9/package.json, §11, §5 |
| Hourly commits | 13:xx, 14:xx and 15:xx all present. **16:xx and 17:xx are still owed** — run `pnpm checkpoint` |

## Score estimate: about 75/100 (was 69)

| Criterion | Est. | Why |
| --- | --- | --- |
| Task fit (25) | **19** | The kit is the default, jury upload works with no restart, e2e is green, and the trap fixtures beat the baselines. But on the showcase employee E0028, 2 of 3 cards (EV_036, EV_008) close **no required gap**. Their score is only grade plus session availability. Their rationale falls back to a template that cites 1 factor kind, so R-04 ("≥3 factors") visibly fails on 2 of 3 cards in the main scenario. The UI subtitle "ranked by how much they close a real, critical gap" is untrue for those two cards |
| Technical (25) | **19** | Solid engine, honest source badge, strict grounding (it caught the weak cards itself), Origin check, audited HR access, and employee-only completion. Deductions: the recommender still emits zero-gap events. The grade path ignores the avoidance signal the recommender uses, so it proposes EV_009, which E0028 abandoned twice — exactly the brief's trap. `expected_progress` in the explanation API uses raw ids (`SK_MENTORING: 2 → 3`) inside ru/kk text. `unresolvedGaps` in the grade-path API reports pre-plan levels (Cloud "effective 1, gap 2" after the plan moves it to 2). The UI panel shows this correctly |
| README (25) | **19** | The gates pass, but several statements are now false (see the overclaims below). A judge who checks §5 will find the SD 3→4 claim wrong. |
| Value (15) | **11** | Voluntary framing, dismiss, no leaderboard, completion employee-only, and an honest "nothing in the catalogue closes this — talk to HR" |
| Originality (10) | **7** | The grade path (O-01) and format avoidance exist, but the README does not mention either and §19 lists grade-transition as *out of scope*, so a README-reading jury will not credit them |

## Overclaims and stale statements (README.md)

1. **L116–117**: "**Mark complete** moves System Design 3 → 4 and the next recommendation takes the top slot." False on the kit. EV_037 moves Mentoring 2→3 and Feedback 2→3, System Design stays at 3, and nothing on the kit closes it (the grade-path panel says so). Replace with the observed result.
2. **L297–299 and L356–359**: "`pnpm test:e2e` … and `pnpm eval` … were not exercised / not re-verified". They now pass: e2e 5/5 and eval 9/9. Report the observed counts.
3. **L297, L304, L307**: `pnpm eval` is described as "promptfoo … cases under `eval/cases/`". In fact `pnpm eval` runs `eval/run.mjs` (custom offline suite, `eval/cases/cases.json`). `promptfoo.yaml` needs a running server and is not what the script runs.
4. **L319–321**: "No screenshot capture … has been committed". False: `docs/assets/employee-e0028.png` and `hr-dashboard.png` exist (both are genuine and match live output). **The README embeds neither.**
5. **L353–354**: "grade-transition simulation" is listed as out of scope, but it is built (`lib/domain/gradePath.ts`, `app/api/employees/[id]/grade-path/route.ts`, `components/GradePath.tsx`, `tests/grade-path.test.ts`). It has no row in §4 and no mention in §5. Format avoidance (`lib/rules/scoring.ts`, commit 64a43b6) is not mentioned either.
6. **L63 / L60**: R-04 is marked ✅, "cites ≥ 3 distinct factors". That is true for the top card only. The grounding check rejects E0028's cards 2 and 3 (1 factor kind). Either fix #2 below or mark R-04 ⚠️ and disclose it.
7. **`package.json` `data:import`** → `scripts/import.mjs` does not exist. The README no longer references it, but a judge running `pnpm run` will see it. This carries over from the previous review.
8. **§8 L216**: "All dataset content is synthetic (`data/seed/`)". The default dataset is now the organizer kit. That is still synthetic, but the path is stale.

## `.env.example` (uncommitted diff)

It is **not needed**. `pnpm start` supplies the demo default, clean-room passes without the diff, and README §11 documents `SESSION_SECRET` fully. Revert it (`git checkout .env.example`) so the tree is clean. Only commit it if the operator stages it by hand outside the hook, and it adds only documentation.

## Remaining fixes (max 6, ranked by points per minute)

| # | Fix | Impact | Min | Exclusive files |
| --- | --- | --- | --- | --- |
| 1 | **README truth pass**: overclaims 1–8 above. Embed both screenshots in §5. Add §4 rows for O-01 grade path and format avoidance, and one §5 line with the `grade-path` curl. Remove grade-transition from §19. Delete the `data:import` script line | +3–4 (README and originality credit; removes the "one false claim taints all" risk) | 15 | `README.md`, `package.json` (one line) |
| 2 | **Stop recommending zero-gap events.** In `recommend`, require at least one develops-skill with a positive gap closure (the `skill_gap`/`next_level_requirement` contribution > 0). If fewer than 3 qualify, return fewer (1–3 is allowed), and keep the rest in the trace as `LOW_FIT`. E0028 will then show 1 strong card instead of 1 strong and 2 template-fallback cards. Update any test that expects 3 | +2–3 (task fit, R-04 holds on every visible card) | 20 | `lib/domain/recommend.ts`, `tests/engine.test.ts`, `tests/requirements.test.ts`; check `e2e/golden-path.spec.ts` |
| 3 | **Make the grade path avoidance-aware.** Skip events the employee dropped or no-showed at least twice, or prefer a same-skill alternative in another format, and report a skipped event as "you left this twice — alternative: …" or as an unresolved gap. Add a test that the E0028-like plan does not start with EV_009 | +1–2 (originality, consistency with the engine's own logic) | 15 | `lib/domain/gradePath.ts`, `tests/grade-path.test.ts` |
| 4 | **Skill names in `expected_progress`.** Use `ds.skills` names, not `SK_*` ids, in the template and the mock (grounding already accepts names) | +1 (rationale quality in ru/kk) | 10 | `lib/ai/template.ts`, `lib/ai/scenarios.ts`, `tests/explain.test.ts` |
| 5 | **Change the UI subtitle** "ranked by how much they close a real, critical gap" to wording that is true (e.g. "ranked by the gap they close, your history and availability"), unless #2 lands | +0.5 | 3 | `lib/i18n/dict.ts` (kk/ru/en key) |
| 6 | **`unresolvedGaps` should report the projected level** after the plan (API only; the UI already does it right) | +0.5 | 5 | `lib/domain/gradePath.ts` (the #3 owner does it) |

Order: run #1 **last**, after #2–#4 land, so the README describes the final behaviour. Rerun `pnpm test && pnpm test:e2e && bash scripts/clean-room-test.sh` after each code fix, and commit at least once in hours 16 and 17.

## Acceptable to ship (honest §19 wording)

- "On the organizer dataset, E0028's critical System Design gap (3 → 4 for Senior) cannot be closed by any remaining eligible event. The app says so ('nothing in the catalogue closes this yet — talk to HR') instead of inventing a step."
- "If fewer than three events close a real gap, fewer are shown." (after #2)
- "HR aggregate views are not audited" and "no dedicated latency benchmark" are already disclosed correctly.
