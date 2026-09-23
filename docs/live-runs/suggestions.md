# Live evidence: AI development-suggestion pipeline (openai:gpt-4o-mini)

- **Date/time:** 2026-09-23, ~17:26–17:35 Astana time
- **Model:** `MODEL_REF=openai:gpt-4o-mini`, key loaded via
  `node --env-file=.env` (never printed, never committed)
- **Method:** production code exercised directly, no reimplementation —
  `buildSuggestContext()` (`lib/domain/suggest.ts`) then `generateSuggestions()`
  (`lib/ai/suggest.ts`), imported through the same Node ESM `.ts`-resolution
  hook `pnpm eval` uses (`eval/lib/ts-loader.mjs`). The driver script lived
  outside the repo (`/private/tmp/.../scratchpad/live-suggest-run.mjs`,
  discarded after the run — not committed).
- **Population:** every kit employee whose `recommend()` result has 0
  recommendations — **34 employees**, confirmed by iterating the full dataset
  with the real `recommend()` from `lib/domain/recommend.ts` (not assumed).
  All 34 called with `locale=en`; the first 5 of that set also called with
  `ru`, and the same first 5 also called with `kk` — **44 live calls total**,
  concurrency 5.

## Summary

| Metric | Value |
| --- | --- |
| Total live calls | 44 |
| `source: llm` (accepted model output) | **0 / 44** |
| `source: template` (fallback) | **44 / 44** |
| Model threw / network error | 0 (all 44 reached OpenAI and got an HTTP response) |
| noStep mix | ALL_DONE 38, PREREQ_BLOCKED 5, CATALOGUE_GAP 1 |
| Suggestion type by noStep (post-validation, all template) | ALL_DONE → `maintain_and_share` (38); PREREQ_BLOCKED → `prerequisite_path` (5); CATALOGUE_GAP → `request_training` (1) |
| Latency (ms), n=44 | p50 **555**, p95 **1148**, max **1477**, min 496 |

## Root cause of the 44/44 fallback (not a flake)

Every single call failed with the identical `fallbackReason`:

```
Model did not return output matching the schema after 2 attempt(s).
```

`generateStructured` (`lib/ai/structured.ts`) swallows the underlying cause
into that one string, so a second debug script called `generateStructured`
directly on a real `SuggestContext` and printed `error.cause`. The real cause
is an **OpenAI API 400**, not a model-quality problem:

```
AI_APICallError: Invalid schema for response_format 'response': In context=
('properties', 'suggestions', 'items'), 'required' is required to be supplied
and to be an array including every key in properties. Missing 'event_ids'.
```

`SuggestOutput` in `lib/ai/suggest.ts` declares `event_ids: z.array(z.string()).optional()`.
OpenAI's Structured Outputs (strict JSON-schema mode, which the AI SDK's
`Output.object` uses for the `openai.responses` provider) rejects any object
schema where an optional key is *absent* from `required` — optional fields
must instead be modelled as nullable, not omitted. The request never reaches
model generation at all; OpenAI rejects the schema itself before running the
prompt. That explains the tight, sub-1.5s latency band across all 44 calls
(it is API round-trip-to-rejection time, not model generation time) and the
100% fallback rate: this is deterministic per-schema, not per-prompt, so it
reproduces on every call regardless of employee, locale, or noStep reason.

This is a **pre-existing bug in `lib/ai/suggest.ts`'s `SuggestOutput` zod
schema**, live-only — the mock provider and `pnpm eval`'s offline suite never
call OpenAI so they never hit this. It was not fixed here: this task was
read-only on code (see the requesting instructions).

## What the fallback path itself demonstrates

Because every call fell back, what this run actually proves live is the
**fallback path**, not the LLM path: `generateSuggestions()` never throws to
its caller, degrades to `buildTemplateSuggestions()` (deterministic, no model
call) on a real OpenAI rejection, and every returned suggestion is still
grounded (validated against `SuggestContext`) — because the template builder
only ever cites ids that are already in context. Grounding validation itself
(`isValidSuggestion` / `isGroundedText`) was exercised for 0 model outputs
here, since none arrived — it is proven separately by the offline eval suite
(see prior commits), not by this run.

## Verbatim examples

**EN** (employee E0018, noStep `ALL_DONE`, source `template`, 1148ms):
```json
{
  "type": "maintain_and_share",
  "skill_id": "SK_TROUBLESHOOTING",
  "title": "Share your expertise in \"Technical Troubleshooting\"",
  "rationale": "Level 1 on \"Technical Troubleshooting\" already meets the role requirement. Offer to mentor a colleague or run a short knowledge-sharing session on it."
}
```

**RU** (employee E0018, noStep `ALL_DONE`, source `template`, 554ms):
```json
{
  "type": "maintain_and_share",
  "skill_id": "SK_TROUBLESHOOTING",
  "title": "Поделиться опытом по «Technical Troubleshooting»",
  "rationale": "Уровень 1 по «Technical Troubleshooting» уже соответствует требованиям роли. Предложите наставничество или короткую сессию обмена опытом для коллег."
}
```

**KK** (employee E0018, noStep `ALL_DONE`, source `template`, 543ms):
```json
{
  "type": "maintain_and_share",
  "skill_id": "SK_TROUBLESHOOTING",
  "title": "«Technical Troubleshooting» бойынша тәжірибе бөлісу",
  "rationale": "«Technical Troubleshooting» бойынша 1 деңгейі рөл талабына сай келеді. Әріптестеріңізге тәлімгерлік немесе тәжірибе бөлісу сессиясын ұсыныңыз."
}
```

For reference, one `PREREQ_BLOCKED` example (employee E0065, en, 535ms):
```json
{
  "type": "prerequisite_path",
  "skill_id": "SK_CONTAINERS",
  "event_ids": ["EV_010"],
  "title": "Close the prerequisite for \"Containers & Orchestration\" first",
  "rationale": "Current level 0 of 1 on \"Containers & Orchestration\" is blocking \"Kubernetes in Practice\". Discuss a short path to that level with your manager before it opens up."
}
```

## Honest findings / limitations

- **No live LLM suggestion was accepted in this run (0/44).** All 44 calls
  hit a genuine OpenAI 400 caused by an `.optional()` array field in the
  response schema, not by prompt/grounding quality — this needs a real code
  fix (e.g. make `event_ids` nullable instead of optional, or omit the key
  entirely and re-add it post-hoc) before `openai:*` suggestions can ever
  return `source: "llm"` in production. Flagging this as the primary finding
  of the run rather than the least interesting one.
- **n is small for ru/kk (5 each)**, and — since every call fell back —
  those 5 are drawn from the same underlying template code path already
  exercised in en, not 5 independent LLM behaviours. They confirm the
  template's locale strings render correctly, nothing about live model
  behaviour in ru/kk.
- **CATALOGUE_GAP is n=1** in this dataset (only one employee lands in that
  noStep reason with 0 recommendations), so the `request_training` row above
  is not statistically meaningful, just the one real example available.
- **Model output was never captured** (OpenAI rejected the schema before
  generating), so there is nothing to report on "how many suggestions the
  model returned vs. how many survived validation" for this run — that
  comparison is exercised instead by the existing offline eval suite
  (`pnpm eval`, `mock:demo`) and the earlier live gpt-4o-mini/gpt-4.1-mini
  eval runs referenced in git history (`66f1894`), which used the `explain`
  pipeline, not `suggest`, and are unaffected by this schema bug (different
  schema shape).
- **Token usage is not reported**: `generateStructured` only returns
  `usage.inputTokens`/`outputTokens` on success; on the 400-rejection path
  used throughout this run, no `usage` object exists to read.
- Latency numbers above are OpenAI's schema-validation-and-reject time, not
  a measure of `gpt-4o-mini` generation latency — do not reuse them as a
  general model-latency benchmark.

---

## Re-run after the schema fix (2026-09-23, 17:28 Astana)

**Root cause of the first run's 0/44:** OpenAI strict structured output rejects
schemas with optional keys, and `event_ids` was `.optional()` in
`lib/ai/suggest.ts`. Every call returned HTTP 400 before generation, so the
code fell back to the deterministic template, as designed. Fix: `event_ids` is
now a required array (`[]` when no event applies), and the template builder
always sets it (`lib/ai/suggest-template.ts`). Offline tests and `pnpm eval`
stayed green.

**Same script, same 44 calls (34 no-step employees; en ×34, ru ×5, kk ×5),
`openai:gpt-4o-mini`:**

| Metric | Value |
| --- | --- |
| `source: "llm"` (model output survived code validation) | 44 / 44 |
| Template fallback | 0 / 44 |
| Suggestions returned after validation | 130 (≈ 3 per call) |
| Types | mentoring 36 · request_training 33 · maintain_and_share 28 · stretch_assignment 16 · peer_learning 12 · prerequisite_path 5 |
| Latency p50 / p95 / max | 2376 ms / 3805 ms / 6977 ms |

`prerequisite_path` appeared 5 times: once per `PREREQ_BLOCKED` call, and only
through unlockable events, which is what validation allows.

**Verbatim examples (all `ALL_DONE` employees):**

- en: `mentoring` on SK_MENTORING: "Peer Mentorship Program": "Engaging in a
  peer mentorship program can further enhance your mentoring skills, which are
  currently a gap."
- ru: `maintain_and_share` on SK_TROUBLESHOOTING: «Поделиться опытом решения
  технических проблем»: «С учетом того, что техническое решение стало одним из
  ваших освоенных навыков, передача знаний другим поможет укрепить вашу
  экспертизу.»
- kk: `maintain_and_share` on SK_TROUBLESHOOTING: «Техникалық проблема шешу
  дағдыларын жетілдіру»: «Сізде техникалық мәселелерді шешу деңгейі 1, ал
  талап 2, сондықтан дағдыларды нығайту қажет.»

**Honest findings:**

- The kk example frames a *mastered* skill as a gap ("level 1, required 2").
  Its numbers exist in the context, so the numeric check accepted it; the
  framing is still inconsistent with the `maintain_and_share` type. A
  type-to-framing check is a follow-up.
- Tokens and cost are not exposed by `generateSuggestions`, so they are not
  reported.
- ru/kk samples are small (n = 5 each).
