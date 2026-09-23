> **Historical snapshot.** This is an internal mid-build review written during the competition. The findings listed here were addressed in later commits (see `git log`); the current state is described in `README.md` and `docs/EVALUATION_GUIDE.md`.

# Independent review, 14:31 Astana (HEAD fe87dd5)

Reviewer stance: every claim is treated as unproven until it is executed. Everything below was either run or read in code during this review.

## What was run

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm test` | 13 files, 73 tests, all pass |
| `bash scripts/clean-room-test.sh` | **PASS**, 8/8 steps, health check returns `mock:demo`, `offline:true` |
| `git archive HEAD` into a scratch dir, then `cp .env.example .env`, install, build, `PORT=3233 pnpm start`, curl the golden path | works (details below) |
| Live: login as E0028 → recommendations | top pick is EV_016 "Architecture Review Mentoring", SD 3→4 (max 4). Matches README §5 |
| Live: E0028 → `/api/employees/E0001/recommendations` | 403 (correct) |
| Live: E0028 → `/api/hr/aggregates` | 403 (correct) |
| Live: POST complete EV_016 with `Origin: http://evil.example` | **200, accepted**. There is no Origin check, although the threat model's T16 says there is one |
| Live: explanations, locale ru | `"why":["skill_gap: вклад 3 (closure=1)","skill_gap: вклад 0 (closure=0)","next_level_requirement: вклад 1 (target=Senior, largestGap=1)","career_goal: вклад 0 (hasGoal=0)"]`, `"source":"llm"` |
| Live: HR opens `/employee/E0005` (page) | 200, **no audit row written**. audit.jsonl held only `progress.event-completed` |
| Seed vs organizer kit comparison | seed has 17 events / 12 skills / 19 role profiles / 40 employees. The kit has 40 / 60 / 32 / 200. **None of the 17 shared EV ids has identical content** |

Both gates are **passed**. It launches from the README with no key, and the eight README elements are present, including §5, the check procedure.

## Estimated score (AI jury view): about 69/100

| Criterion | Est. | Reasons |
| --- | --- | --- |
| Task fit & working scenario (25) | **17** | The golden path works end to end on a clean clone. The trap fixtures pass. The HR view has 3 panels with k<5 suppression. **Biggest risk:** a clean clone runs on a synthetic seed whose EV_007/EV_009/... mean something different from the organizer's kit, and 13 of 32 role/grade pairs are missing, including all Sales, PM and Support roles and QA Lead. The jury's trap profiles are built on the kit. Uploading them to a clean clone will either reject rows ("Unknown event_id", "Unknown role/grade pair") or score them against the wrong event definitions. Uploading `role_profiles` is accepted but ignored (README §19), so the jury cannot fix this themselves through the UI |
| Technical implementation incl. AI (25) | **16** | Strong: effective skill with pending gain, eligibility rules with trace, 7-factor weighted score, signed session, fail-closed guards, atomic import. Weak, and the jury reads this literally: (1) the mock "LLM" output is byte-for-byte the template format and is badged `llm`, so the "AI vs template" honesty claim in README §7 fails in the default mode. (2) The rendered rationale is a `key=value` dump with English factor names inside ru/kk text. (3) `why` takes `factors.slice(0,4)` = F1, F2, F3, F4. It never shows `participation_history` or `grade`, and it shows zero-contribution factors, so the visible rationale cites only 2 of the spec's 4 factor kinds. That breaks R-04 in spirit. (4) `groundingCheck` counts a kind as "cited" if any of its tokens (`"0"`, `"1"`, `"3"`) appears anywhere, so the ≥3-kinds check passes trivially. (5) Factor `values` carry no skill id, name, current or required level, so even a real LLM cannot say "System Design 3 vs 4 required for Senior (critical)". (6) `negativeByFormat` is computed and never used. The real LLM path exists (`openai:*`/`anthropic:*` via `MODEL_REF`, 8 s timeout → template) |
| README & reproducibility (25) | **19** | Clean-room passes, the single command works, and the check procedure is concrete. Deductions: stale/incorrect statements. §4 R-18 and §19 say kk/ru are "placeholder clones of en", but commit 7a8d621 added full translations. §8 says "HR profile views emit recordAudit" and "no-step list (audited)", but only the API route audits; the page and the HR aggregates do not. §7 says the badge is honest, but mock is shown as `llm`. `pnpm data:import` points to `scripts/import.mjs`, which does not exist. Nothing says the jury needs the organizer kit (`DATASET_DIR`) for their profiles. `.env.example` has an uncommitted diff |
| Value (15) | **11** | It speaks to the brief's pain: why a step matters, voluntariness, dismiss, no leaderboard. HR can "complete on behalf of" an employee, which is audited but is a mild voluntariness smell |
| Originality / scaling (10) | **6** | Pending post-review gains and the avoidance signal are non-obvious. The scaling table exists. No O-01 grade-transition plan |

## Prioritised improvements (remaining ~3 h; ownership is exclusive per item)

| # | Change | Impact | Effort | Files (exclusive) |
| --- | --- | --- | --- | --- |
| 1 | **Make the jury-upload scenario work on a clean clone.** (a) Merge `role_profiles` from the import overlay in the loader. (b) README §5 step 7 plus a new "Evaluating with the organizer dataset" note: `DATASET_DIR=/path/to/career_quest_dataset pnpm start`, or drop the kit at `docs/task/career_quest_dataset/`. (c) Ask the organizer on site: "May we commit the Career Quest dataset into our repo, which will be public/judged? If not, will the jury run with the kit present?" | +4 to 6 (task fit, reproducibility) | 20 min | `lib/data/load.ts`, `tests/import.test.ts`; README owner does (b) |
| 2 | **Turn the rationale into real, spec-conforming prose.** Enrich factor `values`: F1/F3 gain `skill_id`, `current`, `required`, `critical`; F5 gains `event_ids` skipped and the format. Mock and template: drop zero-contribution factors, always include skill_gap + next_level_requirement + participation_history + grade when present, use localized kind labels and skill names, and write sentences like "System Design 3 → 4, the Senior requirement (critical)". Keep numbers verbatim so grounding still passes | +4 to 5 (technical, value) | 35 to 45 min | `lib/rules/scoring.ts`, `lib/ai/scenarios.ts`, `lib/ai/template.ts`, `lib/i18n/dict.ts` (factor-label keys only) |
| 3 | **Honest source badge plus a stricter grounding check.** Return `source: "mock"` (i18n label "demo model") when `isOfflineMode()`. The kinds-cited check should match on the kind label or the distinctive value, not bare `0`/`1`. Add a test that the rendered `why` for E0028 covers ≥3 of {grade, skill_gap, participation_history, next_level_requirement} | +2 to 3 (technical: "implementation matches stated logic") | 15 to 20 min | `lib/ai/explain.ts`, `lib/ai/grounding.ts`, `components/RecCard.tsx`, `tests/explain.test.ts`, `lib/contracts.ts` (Explanation.source enum) |
| 4 | **README truth pass.** Fix R-18 status and §19 (kk/ru now translated). Scope §8 audit claims to what exists, or fix #5 first. Describe the badge semantics from #3. Remove the `data:import` claim or script. Reconcile the SESSION_SECRET wording and commit `.env.example`. Remove "not exercised" hedges once e2e/eval have actually been run | +2 to 3 (README; removes the "unsupported claim taints others" risk) | 15 min, run last | `README.md`, `.env.example`, `package.json` (`data:import` line) |
| 5 | **Audit HR individual access at the page level (T5).** Call `recordAudit` in `app/employee/[id]/page.tsx` when `session.role==="hr"` *before* rendering, and render the error state if it throws (audit failure denies). Also audit the HR aggregates view | +1 to 2 (technical/security) | 15 min | `app/employee/[id]/page.tsx`, `app/hr/page.tsx`, `tests/authz.test.ts` |
| 6 | **Origin check for non-GET (T16).** In `withErrorHandling`, reject with 403 when `Origin` is present and its host ≠ `Host`. Add a test. (SameSite=Strict already blocks this in browsers, but the threat model claims this control and a judge can curl it) | +1 | 10 min | `lib/http/validate.ts`, `tests/security.test.ts` |
| 7 | **Use the avoidance signal visibly.** Apply `negativeByFormat` so that repeated offline no-shows favour a self_paced/online alternative. Show "you skipped N similar sessions; this one is self-paced" in the trace/rationale. This is the brief's own trap pattern and the strongest originality point | +1 to 2 (originality, task fit) | 25 min | `lib/rules/scoring.ts` (coordinate with #2: do it after #2 or have the same owner), `tests/engine.test.ts` |
| 8 | **Remove government-scaffold residue a judge will read.** The audit actor role enum is `citizen/officer`, and the comments mention "Government systems". Rename to `employee/hr`. Also drop the stale scaffold comment ("Replace these with scenarios…") in `scenarios.ts` | +0.5 to 1 (consistency) | 10 min | `lib/audit/audit.ts`, callers in `app/api/**` (grep `role: "officer"`), `lib/ai/scenarios.ts` header (coordinate with #2) |

Suggested parallel split: A = #1 · B = #2 then #7 then the #8 scenarios header · C = #3 · D = #5, #6, #8 audit enum · README owner = #4, last.

## Acceptable to ship (honest wording for README §19)

- "The committed `data/seed/` is a small synthetic dataset (40 employees, 17 events) that does not reproduce the organizer's kit. To evaluate with the organizer's profiles, set `DATASET_DIR` to the kit." This line is needed whether or not #1 is done.
- "In offline mode (`MODEL_REF=mock:demo`) the explanation is produced by a deterministic scripted model, not an LLM, and is labelled as such."
- "The session cookie is `Secure` under `NODE_ENV=production`. Browsers accept it on `http://localhost` but not on a plain-HTTP LAN IP." Open the app via localhost. Untested risk: older Safari on localhost.
- "HR may mark an event complete on behalf of an employee (data correction); every such action is audited."

## Note

To free the port, this review ran `pkill -f "next start"` at the end, which would also have stopped any other `next start` process on this machine. No repository files were changed except this report.
