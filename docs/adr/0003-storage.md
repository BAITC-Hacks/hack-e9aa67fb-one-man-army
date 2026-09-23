# ADR-0003: File-backed storage by default

- **Status:** accepted
- **Date:** 2026-09-19
- **Deciders:** kit author

## Context

A judge must go from `git clone` to a running app with no daemon to start and no
native module to compile. `better-sqlite3` needs a native build, which is the
classic clean-room failure: it works on the author's machine and fails in Docker
or on a different libc.

## Decision

Default to a small file-backed store (`lib/store/jsonl.ts`): append-only JSONL for
event-shaped data and JSON documents for the rest, under `DATA_DIR`.

## Alternatives considered

| Option | Cost | Why not |
| --- | --- | --- |
| `better-sqlite3` | native compilation | Clean-room and Docker risk for no gain at demo scale |
| `node:sqlite` (built in, verified working on Node 22.16) | none | Prints an experimental warning; genuinely the best upgrade path, but unnecessary for hundreds of records |
| Postgres | a service judges must run | Directly contradicts reproducibility |
| In-memory | zero | State lost on restart; the audit trail must persist |

## Consequences

**Good:** zero dependencies, zero setup. Seed data is a git-diffable file, and
`demo:reset` is a file write — which is what makes the demo repeatable. Path
traversal is blocked in `resolveDataPath`.

**Bad:** no concurrent-write safety, no indexes, no transactions. Fine for a
single-process demo with hundreds of records; not fine beyond that.

**Reversible?** Yes — the store is a handful of functions behind a narrow
interface. The documented upgrade is `node:sqlite` first, Postgres only if
concurrency or scale genuinely demands it. Trigger: >100k records or concurrent
writers.
