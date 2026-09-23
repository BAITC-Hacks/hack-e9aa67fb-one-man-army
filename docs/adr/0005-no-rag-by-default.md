# ADR-0005: No retrieval layer until a requirement forces one

- **Status:** accepted
- **Date:** 2026-09-19
- **Deciders:** kit author

## Context

Reaching for a vector database is the reflex move in AI hackathons. It usually
wraps a corpus small enough to filter with `Array.prototype.filter`, costs an
hour, and adds a failure mode on stage.

## Decision

Build no retrieval by default. `.claude/skills/rag-decision-guide` provides a
ladder — typed query, exact lookup, load-and-filter, full-text, embeddings — and
requires stopping at the first rung that works.

Embeddings need a *demonstrated* failure of the rung above: a concrete query that
keyword search gets wrong. "Users might phrase it differently" is not evidence.

## Alternatives considered

| Option | Cost | Why not |
| --- | --- | --- |
| Ship a pgvector setup | 60+ min, plus a service | Speculative; the challenge is unknown |
| Ship an embedding helper "just in case" | 20 min | Unused code that must still be disclosed |

## Consequences

**Good:** an hour stays available for functionality that is actually scored. No
vector service to run in the clean-room test.

**Bad:** if the challenge genuinely needs semantic retrieval, it is built from
scratch under time pressure. Mitigated by the decision ladder and by the
retrieval-evaluation guidance in `.claude/skills/ai-evaluation`.

**Reversible?** Yes, and the cost of adding it later is the same as adding it now.
Deferring is therefore free.

**Note:** cross-language kk/ru/en matching is the one case in this domain that
genuinely justifies embeddings. If the challenge requires it, that is the
evidence, and the ladder is satisfied immediately.
