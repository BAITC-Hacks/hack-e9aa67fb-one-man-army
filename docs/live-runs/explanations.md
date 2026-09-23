# Live run: recommendation-explanation pipeline (`lib/ai/explain.ts`)

- **Date/time:** 2026-09-23, 17:22 Asia/Almaty (12:22 UTC)
- **Model:** `MODEL_REF=openai:gpt-4o-mini` (live provider; key read from repo
  `.env` via `node --env-file=.env`, never printed or committed)
- **Method:** throwaway script in the session scratchpad (not in this repo),
  reusing the `eval/lib/ts-loader.mjs` relative-`.ts`-resolution approach so it
  imports and calls the **real** `lib/ai/explain.ts`, `lib/domain/recommend.ts`
  and `lib/data/load.ts` directly — same production code the app and `pnpm eval`
  exercise, not a reimplementation. Invoked as:
  `node --env-file=.env --experimental-transform-types --experimental-loader
  ./eval/lib/ts-loader.mjs <script>`.
- **Sample:** the kit dataset (`docs/task/career_quest_dataset`) has 200
  employees; 166 of them have at least one recommendation. Deterministic
  selection: every ~5th employee id, sorted, among the 166 with recommendations
  (`step = floor(166/30) = 5`), giving 30 employees. Each employee's top
  recommendation was explained in `en` (30 calls); the first 10 of those 30
  were also explained in `ru` and `kk` (10 + 10 calls). **Total: 50 live calls**,
  concurrency capped at 5.

## Summary

| Metric | Value |
| --- | --- |
| Calls | 50 |
| `source=llm` (accepted) | 33 (66%) |
| `source=template` (fallback) | 17 (34%) |
| Fallback reason: <3 distinct factor kinds cited | 15 |
| Fallback reason: hallucinated/ungrounded number or id | 2 |
| Fallback reason: timeout / provider error | 0 |
| Latency (ms), whole `explain()` call, both outcomes | p50 = 2111, p95 = 3178, max = 3510, min = 1502 |
| Tokens | not exposed — see Limitations |
| Cost estimate | not computed — see Limitations |
| `why` lines on accepted calls | all 3–4 (schema-valid, min 3) |

All 17 template fallbacks are grounding rejections, not provider failures — the
model responded every time within the 8s budget; `groundingCheck` in
`lib/ai/grounding.ts` then rejected roughly a third of those responses because
they didn't cite at least 3 distinct factor kinds (15 cases) or included a
number/id absent from the engine's `factors`/`expected` (2 cases). No call
timed out or threw a provider error. This is the designed fail-safe behaviour
(ADR-0007): the model never gets to phrase a rejected explanation to the user —
the deterministic template runs instead.

## Per-locale breakdown

| Locale | Calls | `llm` | `template` |
| --- | --- | --- | --- |
| en | 30 | 20 (67%) | 10 (33%) |
| ru | 10 | 6 (60%) | 4 (40%) |
| kk | 10 | 7 (70%) | 3 (30%) |

Sample sizes for ru/kk are too small (n=10 each) to treat the per-locale gap as
significant; it is consistent with sampling noise around the overall ~66%
acceptance rate.

## Verbatim examples (accepted, `source=llm`)

All three are for employee `E0001`, event `EV_005` ("System Design
Fundamentals" / "Основы проектирования систем" / "Жүйелік дизайн негіздері"),
so the three texts are directly comparable across locale.

### en (latency 2746 ms)

> **Headline:** System Design Fundamentals
>
> - There is a significant skill gap in System Design, which has a weight of
>   3, indicating a strong need for improvement in this area.
> - The employee is currently at the Junior grade but has a target to reach
>   Middle grade, highlighting the importance of developing skills necessary
>   for progression.
> - Participation history shows no negative records, suggesting that the
>   employee is open to learning, which is beneficial for engaging in new
>   training.
>
> **Expected progress:** With this training, the employee is expected to
> enhance their System Design skills from level 1 to level 2 and improve API
> Design skills from level 2 to level 3.

### ru (latency 2386 ms)

> **Headline:** Основы проектирования систем
>
> - Существует значительный пробел в навыках проектирования систем у
>   сотрудника, что требует повышения квалификации.
> - Переход на средний уровень горизонтально для карьеры обеспечит
>   соответствие ступени, относящейся к карьерной цели.
> - Требуется улучшение навыков API проектирования, чтобы достичь целевого
>   уровня.
> - Обучение в онлайн-формате позволяет гибко планировать занятия, что удобно
>   для сотрудника.
>
> **Expected progress:** Ожидается, что уровень навыков в проектировании
> систем повысится с 1 до 2, а навыки проектирования API — с 2 до 3.

### kk (latency 2361 ms)

> **Headline:** Жүйелік дизайн негіздері
>
> - Осы курс арқылы болатын шеберлік тапшылығы шешіледі, бұл қызметкердің
>   жүйелік дизайн бойынша тереңірек түсінік алуға мүмкіндік береді.
> - Сондай-ақ, орташа деңгейдегі талаптарға сай болу үшін қажетті білім
>   деңгейін арттыру маңызды, себебі қызметкердің қазіргі деңгейі - бастауыш.
> - Курс қызметкердің карьералық мақсаттарына сәйкес келетіні маңызды, өйткені
>   ол орта деңгейге жетуге ұмтылуда.
>
> **Expected progress:** Бұл оқу нәтижесінде қызметкердің жүйелік дизайн
> шеберлігі 1 деңгейден 2 деңгейге көтерілетін болады, ал API дизайны бойынша
> шеберлігі 2 деңгейден 3 деңгейге артады.

## Honest findings / limitations

- **Grounding is the dominant rejection path in real traffic, not an edge
  case.** A third of live gpt-4o-mini calls were rejected for under-citing
  factor kinds. That validates the fallback exists for a real failure mode,
  but it also means roughly 1 in 3 real users see the deterministic template
  instead of a model-phrased explanation with this model/prompt as currently
  written. Worth a follow-up: tune `buildInstructions` in `lib/ai/explain.ts`
  to more explicitly enumerate the factor kinds that must each get a sentence,
  which should lower the "<3 kinds" rejection rate without weakening the
  grounding check itself.
- **Tokens/cost not captured.** `generateStructured` (`lib/ai/structured.ts`)
  computes `usage.inputTokens`/`outputTokens`, but `explain()` does not return
  it in the `Explanation` object, so this read-only run could not observe
  token counts or estimate cost without editing pipeline code (out of scope
  under the read-only constraint for this run). Reported as "not exposed"
  rather than estimated.
- **Small per-locale n.** ru/kk are 10 calls each; the per-locale acceptance
  numbers above are directional only, not statistically reliable.
- **Sample is one recommendation per employee (the top one only)**, per the
  task's scope — lower-ranked recommendations for the same employees were not
  exercised and may have different grounding behaviour (fewer contributing
  factors → more likely to fall under 3 kinds).
- **No prompt-injection probe in this run** — the sample used real kit data as-is
  (titles/factors are trusted, engine-produced strings, not free user text), so
  this run does not add injection evidence beyond what `eval/run.mjs`'s
  `injection-title-instruction-ignored` case already covers offline.
- This run required a live `OPENAI_API_KEY` from `.env`; it is not part of the
  offline `pnpm eval` / clean-room path and was executed outside the repo
  (scratchpad script, discarded) specifically so it never becomes a hidden
  dependency of the graded offline pipeline.
