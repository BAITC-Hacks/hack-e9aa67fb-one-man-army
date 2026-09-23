# ADR-0006: Dataset loaded in memory from a configurable dir, with file-store overlays

- **Status:** accepted
- **Date:** 2026-09-23
- **Deciders:** architect

## Context
R-12 requires the app to launch from a clean clone. AMB-01 says the official kit may not be committable. R-09 requires jury uploads to take effect without a restart. R-05 and I-12 require completions to persist.

## Decision
`lib/data/load.ts` resolves the dataset directory in this order: `DATASET_DIR`, then `docs/task/career_quest_dataset/` if it exists, then the committed synthetic `data/seed/` (same schema). It holds the parsed dataset in a process singleton. Mutations are never written to the base files. They go to overlays in the existing file store: `imports.json` (upserts), `completions.jsonl`, `dismissals.jsonl`. Every write calls `invalidateDataset()`, and the next read rebuilds the singleton (about 3k rows, a few ms).

## Alternatives considered
| Option | Why not |
| --- | --- |
| SQLite / Postgres | a second datastore; clean-room risk (ADR-0003) |
| Rewrite the base files on import | loses `demo:reset` determinism and mixes jury data into the kit |
| Commit the raw kit only | blocked by AMB-01 until the organizer answers |

## Consequences
Good: no restart on upload, `demo:reset` = truncate the overlays, and the base data stays read-only. Bad: single process only, and there is no write concurrency. Reversible: yes, since `getDataset()` is the only read seam.
