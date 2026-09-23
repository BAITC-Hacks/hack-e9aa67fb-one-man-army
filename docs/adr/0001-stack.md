# ADR-0001: Default technology stack

- **Status:** accepted
- **Date:** 2026-09-19
- **Deciders:** kit author

## Context

A five-hour window leaves no room to discover that two pinned versions are
incompatible. The stack had to be chosen *and empirically verified together*
before competition day.

## Decision

Next.js 16.3.5 · React 19.3.0 · TypeScript 7.0.2 · Zod 4.6.5 · AI SDK 7.0.107 ·
Vitest 5.0.1 · Tailwind 4.3.3 · Playwright 1.63.0 · pnpm · Docker.

Verified by building a throwaway app: install, `tsc --noEmit` clean, `next build`
succeeds (1.5s, Turbopack), `vitest run` passes.

## Alternatives considered

| Option | Cost | Why not |
| --- | --- | --- |
| Pin TypeScript 5.x | safer-looking | 7.0.2 is `latest`, is much faster, and typechecked the whole spine cleanly |
| Stay on AI SDK 6 | fewer renames | 7 is current; migrating mid-competition would be worse |
| Vite + Express | more familiar split | two processes, two configs, no benefit for one app |

## Consequences

**Good:** every version is current, so documentation and model knowledge match
what is installed. Turbopack builds are fast enough to run in the edit loop.

**Bad:** AI SDK 7 renamed a great deal (`system`→`instructions`,
`stepCountIs`→`isStepCount`, `onFinish`→`onEnd`, `fullStream`→`stream`,
`generateObject` deprecated). The spine absorbs this so competition code does not
have to, and `.claude/skills/agent-tool-design` documents the renames.

**Known incompatibility.** `typescript-eslint` does not support TypeScript 7, so
`eslint-config-next` cannot load. The kit uses **Biome** for linting instead — it
parses TypeScript itself and does not embed the compiler. Before reaching for any
tool that wraps the TypeScript compiler API during the competition, check that it
supports TS 7; if it does not, do not spend time fighting it.

Also note `next lint` was removed in Next.js 16 entirely, independent of TS 7.

**Reversible?** Mostly. The provider abstraction isolates the AI SDK; swapping
Next.js would not be reversible mid-competition, which is why it was verified now.
