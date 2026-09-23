# Case selection — T+00:25

Nine cases were screened by parallel analysts against one scorecard. Every case
uses the same jury rubric: **25 task fit · 25 technical · 25 README/repro · 15
value · 10 originality**. So the choice turns on clarity, crowding, how much
rigour is visibly rewarded, and fit with our TS / deterministic-rules scaffold.

Selection criteria (operator): feasible on time with high software + security
standards; data available; clear instructions; not easy (crowded by ~2500
mostly-student entrants); not research-hard; AI judge reads the repo.

| # | Case | Clarity | Feasible | Difficulty (3=ideal) | Security fit | Stack fit | Hidden check | Main risk | Score |
|---|---|---|---|---|---|---|---|---|---|
| 9 | Halyk — Career Quest (next-step navigator) | 5 | 5 | 3 | high (role separation, privacy in spec) | TS ✔ | 3 trap profiles defeating single-factor rules | factor weighting on unseen profiles | **9** |
| 3 | Astana Innovations — "Akim for 5 hours" budget sim | 5 | 5 | 2.5 | medium | TS ✔ | none | crowded, easy; civic not finance | 9 |
| 2 | Beeline — tariff campaign agent (bandit + budget) | 4 | 5 | 3 | thin | Python only | hidden env leaderboard | hidden-env luck; scaffold unused | 8 |
| 8 | Elektrokomplekt — replenishment orders | 4 | 4 | 3 | good | TS ✔ | none | messy real 1C Excel; data licensing | 8 |
| 5 | Elektrokomplekt — ekt.kz shop chat assistant | 4 | 4 | 3 | high | TS ✔ | none | crowded chatbot; live partner API | 8 |
| 7 | Firebird — contractor matching w/ explanations | 5 | 5 | 2 | medium | TS ✔ | live check | crowded, easy | 8 |
| 1 | Freedom — AML "Money Graph" roles | 5 | 5 | 2–3 | low | Python-leaning | none | crowded; starter hands out method | 7 |
| 4 | Kazakhtelecom — org-structure diff agent | 4 | 4 | 3 | good | TS ✔ | hidden control docs | offline semantic matching generalisation | 7 |
| 6 | Samruk-Kazyna — meeting minutes (STT) | 4 | 3 | 3 | high | needs Python ML | none | Kazakh STT quality, model downloads | 7 |

## Recommendation: #9 Halyk Career Quest

- Hidden jury test = 3 profiles *designed* to break single-factor rules — rewards
  exactly a traceable multi-factor rules engine, which a typical LLM wrapper fails.
- Spec itself demands role separation (employee / HR), engagement privacy,
  explainability, no public rankings — security and quality are graded, not decoration.
- Clean synthetic dataset in en/kk/ru, explicit growth rules; nothing to obtain.
- Maps onto the scaffold: Next.js UI, `lib/rules/` engine with traces, mock AI for explanations.
- Bank sponsor — nearest to the Finance track framing.

Open items:
- LIKELY: committing the starter kit is allowed ("not taken outside the hackathon";
  repo is in the organizer org). Ask organizer: *"May the Career Quest starter kit
  be committed to our team repository in the BAITC-Hacks org?"* Fallback: same-schema generator.
- Case 2 (Voice Router) in the Halyk doc is unspecified and has no data — ignore.
