# ADR-0007: The LLM only phrases the engine trace; grounding check plus template fallback

- **Status:** accepted
- **Date:** 2026-09-23
- **Deciders:** architect

## Context
N-01 forbids single-field "AI". R-04 needs ≥ 3 factors with real numbers. R-10 caps AI latency at 10 s. R-13 needs full function without keys. The judges will check that the claims match the code.

## Decision
Selection and scoring are deterministic (`lib/rules/`, `lib/domain/recommend.ts`). The only model call is `lib/ai/explain.ts`: `generateStructured` over `{factors[], expected[], locale}` with an 8 s timeout. The output must pass `groundingCheck`: every number and every SK_/EV_ id in the text must appear in the factors, and ≥ 3 factor kinds must be cited. If it fails, or on timeout or provider error, the result is the deterministic kk/ru/en template (`source:"template"`, shown in the UI). Offline, `mock:demo` returns grounded scripted text. The explain endpoint rejects event ids the engine did not return.

## Alternatives considered
| Option | Why not |
| --- | --- |
| LLM picks or re-ranks events | the model would be deciding; nondeterministic; fails the trap-profile tests unpredictably |
| Tool-using agent loop | no requirement forces it; more failure modes |
| No LLM at all | loses the "use of AI" part of the 25-point technical criterion, and the kk/ru phrasing |

## Consequences
The demo cannot be broken by the model. The README must state plainly: "deterministic engine decides, AI explains".
