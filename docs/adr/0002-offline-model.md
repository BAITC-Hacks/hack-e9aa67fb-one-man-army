# ADR-0002: Deterministic offline model as the default

- **Status:** accepted
- **Date:** 2026-09-19
- **Deciders:** kit author

## Context

Reproducibility is 20 of 100 points, and judges run the repository without our
credentials. Two further facts sharpen this:

1. The competition is expected to provide **ChatGPT/Codex Pro**, which is a
   coding assistant — it does **not** supply an API key for the application's own
   runtime model calls.
2. Hackathon networks are unreliable and rate limits are real.

A demo that needs a key is a demo that may not run when it matters.

## Decision

`MODEL_REF=mock:demo` is the default in `.env.example`. It resolves to a
hand-written `LanguageModelV4` implementation that returns scripted, deterministic
responses through the **real AI SDK code path** — `generateText`, `Output.object`,
tool calls and all.

Live providers are opt-in via one environment variable and fail closed with a
named error if their key is missing.

## Alternatives considered

| Option | Cost | Why not |
| --- | --- | --- |
| Require an API key | zero | A judge without one sees nothing; 20 points at risk |
| Use `MockLanguageModelV4` from `ai/test` | zero | It is a dev dependency; the demo and the Docker image need this at runtime |
| Record and replay real responses | ~40 min | Needs a key to record, and drifts from the code path |
| Silently fall back to mock when a key is absent | zero | A misconfigured deployment would look like it worked |

## Consequences

**Good:** tests, the seeded demo, CI, Docker and the clean-room check all run with
no credentials and produce byte-identical results. Screenshots are reproducible.

**Bad:** scripted replies must be kept plausible, since the demo presents them as
real product behaviour. Every new AI path needs a scenario in
`lib/ai/scenarios.ts`, and agents are instructed accordingly.

**Reversible?** Entirely — it is one environment variable.
