# Final review 2, 15:37 Astana (HEAD ea8af94)

Read-only audit. The only file changed is this one. The server ran on port 3391 with `DATA_DIR` in a scratch directory, so repo `data/` was not touched. It was killed by PID afterwards and the tree is clean.

## VERDICT: SHIP (no blockers). About 78/100, up from 75.

## What was run

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm test` | **17 files, 108 tests, all pass** |
| `pnpm eval` | **9/9 pass** |
| `pnpm start` (existing build, 15:29), `/api/health` | `mock:demo`, `offline:true` |
| Throwaway vitest scan of all 200 kit employees (deleted afterwards) | recs count: 0 → 37 (LOW_FIT 32, ALL_DONE 5), 1 → 48, 2 → 31, 3 → 84 |
| Live E0028: recs → explain → complete EV_037 → recs, grade-path, page | see (a) |
| Live E0137: same flow | see (a) |
| HR import of `data/fixtures/trap-F01..F06` (json + csv), then T9001..T9006 recs | 0 errors each; each gets 3 recommendations, none empty. **No regression** |
| `clean-room-test.sh` | **Not rerun** (budget). It passed at 9e468d3. The changes since then are engine, UI and docs only. Docker was reported verified by the operator, not by me |

## Gates

- Launch from the README: PASS at the last clean-room run. The steps are unchanged.
- No personal account: PASS (`mock:demo`, demo login).
- 8 README elements: PASS.
- Hourly commits: 13, 14 and 15 are present. **16:xx and 17:xx are still owed.**

## (a) Main scenario: E0028 is now a weak demo. Switch to E0137.

**E0028 today:** 1 card (EV_037 Mentor Track, score 3). It closes only a *non-critical* gap, so there is no critical-gap story. After **Mark complete**:

- recommendations are empty with `noStep: LOW_FIT`, while 11 gaps remain, including the critical System Design 3→4;
- on the same page, the grade path still proposes EV_009 and EV_010 (both previously dropped). The panel does explain the skips, but "no step" next to "2 steps" confuses a judge.

**The README is inaccurate here.** §5 says "the next eligible card takes the top slot" (false: there is no next card). §5 and §19 still say "relevance filtering is being tightened… an engineer is actively filtering". That work shipped in b7c8a20, so the text is stale and reads as unfinished.

**Recommended demo employee: E0137**, Backend Engineer, Middle → Senior. It has the same role as E0028, so the prose barely changes. Observed live:

| # | Event | Format | Score | Story |
| --- | --- | --- | --- | --- |
| 1 | EV_006 Designing High-Load Systems | offline | 8 | closes **2 critical** + 1 non-critical levels (F1=6); SD 2→3, API 3→4, Obs 2→3 |
| 2 | EV_009 Cloud Certification Prep | self_paced | 6.5 | Cloud 0→1, CI/CD 1→2 |
| 3 | EV_007 Architecture Review Circle | online | 6 | critical SD 2→3; **format switch: "You skipped 1 similar offline session(s) before; this one is online."** (F6=+1) |

- All 3 explanations are `source:"mock"`, with 4–5 grounded sentences each. No template fallback.
- After completing EV_006: SD 2→3, API 3→4, Obs 3. The new list is EV_009 6.5, EV_007 5 (still closes the critical SD 3→4), and EV_036 2. The trajectory moves and a card is still left to show.
- Honest caveat: EV_006 is the event E0137 no-showed on 2026-06-22 (history R002489). The rationale says "1 skipped or no-show record was weighed", and the penalty is visible (F5 −1.5, F6 −1). That is defensible and a good Q&A point ("one no-show does not bar it; the online alternative is #3").
- Runner-up: **E0139** (Customer Support, Senior). 3 cards, two of them critical, but all carry negative-history penalties, so the story is less clean.

## (b) HR import: no regression

F01–F06 each import with 0 errors. T9001–T9006 each get 3 recommendations. T9001's top is EV_006, not the avoided Public Speaking event.

## (c) UI confusion found

1. **A raw i18n key is shown on every profile**: `recs.blockedReason.no-gap (2)` appears in the "not available to you" group (seen in ru for E0028 and E0137). The rule id `no-gap` (`lib/domain/recommend.ts:191`) has no dictionary entry in any locale. This is a regression from b7c8a20. The key-parity test does not catch dynamic keys.
2. After completing E0028's only card, the page shows "no step (LOW_FIT)" next to a 2-step grade path. Switching the demo to E0137 avoids this.
3. Minor: format values are shown raw (`offline`, `self_paced`). A self-paced card shows "Ближайших сессий нет", while its rationale says "you can start right away". The Russian "2 раз" is ungrammatical. The subtitle "ranked by… critical gap" is untrue for E0028's only card (non-critical), but fine for E0137.

## Fixes (max 3, ranked by points per minute)

| # | Fix | Impact | Min | Exclusive files |
| --- | --- | --- | --- | --- |
| 1 | Add `recs.blockedReason.no-gap` in en/ru/kk (for example en "Closes none of your gaps", ru "Не закрывает ваших пробелов", kk "Сіздің олқылықтарыңызды жаппайды") | +1. Removes a visible raw key on the demo page | 3 | `lib/i18n/dict.ts` |
| 2 | **Switch the README §5 demo to E0137** with the observed values above (3 cards, critical + format-switch, completing EV_006 moves SD 2→3 and EV_007 stays as the next critical step). Delete the stale "relevance filtering is being tightened / engineer is actively filtering" text in §5 and §19. Replace it with "only events that close a real gap are shown; if none do, the reason is shown (e.g. E0028 after Mentor Track → LOW_FIT)". Update `docs/demo-script.md` to match. Retake `docs/assets/employee-e0028.png` as E0137 only if `pnpm screenshots` is quick, otherwise keep it (it is still genuine) | +2–3 (README accuracy and main-scenario quality) | 12 | `README.md`, `docs/demo-script.md` (and `scripts/capture-screenshots.mjs` plus `docs/assets/` if the screenshot is retaken) |
| 3 | Check that the e2e golden path does not rely on E0028 getting more than 1 card or on "next card takes top slot". If the README moves to E0137, retarget `e2e/golden-path.spec.ts` to E0137, then run `CI=1 pnpm test:e2e` and `bash scripts/clean-room-test.sh` once before the 16:xx commit | +1 (keeps the evidence matching the README; the gate is re-proved) | 10 | `e2e/golden-path.spec.ts` |

Then run `pnpm checkpoint` and commit in hour 16 and again in hour 17.

## Acceptable to ship (honest wording)

- "Only events that close a real skill gap are recommended, so some employees get 1–2 cards or none (`LOW_FIT`, `ALL_DONE`), with the reason shown."
- "Some gaps (e.g. E0028's critical System Design 3→4) have no eligible event in the organizer catalogue; the app says so instead of inventing a step."
- The two known limitations already disclosed (HR aggregates not audited, no latency benchmark) stay as written.
