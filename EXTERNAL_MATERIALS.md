# External materials disclosure

HackAlem requires disclosure of previously created code, libraries, models,
templates and datasets. This file is the complete record.

## A. Prepared before the competition

Installed by the HackAlem preparation kit at 2026-09-23T07:58Z.
Author: the participant. Not generated from any third-party template.

| Path | Source | Category | Purpose | Added | SHA-256 (first 16) |
| --- | --- | --- | --- | --- | --- |
| `docs/adr/0001-stack.md` | HackAlem prep kit | docs | ADR: validated stack and its known incompatibilities | 2026-09-23T07:58Z | `a36dd941f44623fd` |
| `docs/adr/0002-offline-model.md` | HackAlem prep kit | docs | ADR: deterministic offline model as the default | 2026-09-23T07:58Z | `9217143225843d11` |
| `docs/adr/0003-storage.md` | HackAlem prep kit | docs | ADR: file-backed storage | 2026-09-23T07:58Z | `2a95d3430d14a89d` |
| `docs/adr/0004-no-auth-provider.md` | HackAlem prep kit | docs | ADR: seeded roles instead of an auth provider | 2026-09-23T07:58Z | `cf98538bfd58e254` |
| `docs/adr/0005-no-rag-by-default.md` | HackAlem prep kit | docs | ADR: no retrieval until a requirement forces it | 2026-09-23T07:58Z | `9838817f1b440b5a` |
| `SECURITY.md` | HackAlem prep kit | docs | Security policy and threat model base | 2026-09-23T07:58Z | `c85cff2d84485a40` |
| `scripts/clean-room-test.sh` | HackAlem prep kit | script | Clean-environment reproducibility check | 2026-09-23T07:58Z | `cbf943f34fc6fa5c` |
| `scripts/verify.sh` | HackAlem prep kit | script | Final validation sequence | 2026-09-23T07:58Z | `37d52ddde040525f` |
| `scripts/capture-screenshots.mjs` | HackAlem prep kit | script | Playwright demo screenshot capture | 2026-09-23T07:58Z | `2ee87ca101f251fc` |
| `scripts/demo.mjs` | HackAlem prep kit | script | Demo seed and reset | 2026-09-23T07:58Z | `b1881d1d0c43637a` |
| `.github/workflows/ci.yml` | HackAlem prep kit | ci | Install, lint, typecheck, test, build | 2026-09-23T07:58Z | `0e7c5e46cc7e7016` |
| `.github/workflows/e2e.yml` | HackAlem prep kit | ci | Manual E2E and evaluation run | 2026-09-23T07:58Z | `85162128a3e54e27` |
| `.github/workflows/security.yml` | HackAlem prep kit | ci | Manual dependency and ZAP scan | 2026-09-23T07:58Z | `e537f65e9be9c02f` |
| `.env.example` | HackAlem prep kit | config | Documented environment variables | 2026-09-23T07:58Z | `5f191cd68aab4119` |
| `.dockerignore` | HackAlem prep kit | config | Docker build context exclusions | 2026-09-23T07:58Z | `c83009df3bbe6231` |
| `promptfoo.yaml` | HackAlem prep kit | config | AI evaluation suite config | 2026-09-23T07:58Z | `9cc6d25002f85aeb` |
| `Dockerfile` | HackAlem prep kit | config | Multi-stage production image | 2026-09-23T07:58Z | `e514dec385b5335f` |
| `docker-compose.yml` | HackAlem prep kit | config | One-command run for judges | 2026-09-23T07:58Z | `19f7ab5b61ab27a4` |
| `vitest.config.ts` | HackAlem prep kit | config | Test config with @/ alias and offline model | 2026-09-23T07:58Z | `02258ad8819f5710` |
| `tsconfig.json` | HackAlem prep kit | config | TypeScript strict config with @/ paths | 2026-09-23T07:58Z | `fa240800ce92599a` |
| `next.config.ts` | HackAlem prep kit | config | Next config with standalone output for Docker | 2026-09-23T07:58Z | `e8ad658fa50d793f` |
| `package.json` | HackAlem prep kit | config | Scripts and pinned dependencies (pnpm pinned via packageManager) | 2026-09-23T07:58Z | `0a3fc57c4f9ba45a` |
| `postcss.config.mjs` | HackAlem prep kit | config | Tailwind v4 PostCSS plugin | 2026-09-23T07:58Z | `a1a188221f064d96` |
| `biome.json` | HackAlem prep kit | config | Linter config (Biome - typescript-eslint cannot parse TS 7) | 2026-09-23T07:58Z | `d8ff5e17d8eec5b4` |
| `.nvmrc` | HackAlem prep kit | config | Node version for this repo (nvm use) | 2026-09-23T07:58Z | `68ca3fba3b7e8647` |
| `pnpm-workspace.yaml` | HackAlem prep kit | config | pnpm settings: deterministic installs in clean environments | 2026-09-23T07:58Z | `ec4a505a60d51a80` |
| `app/api/health/route.ts` | HackAlem prep kit | source | Layout, placeholder page, health endpoint | 2026-09-23T07:58Z | `08307ba1a5c6c2ce` |
| `app/globals.css` | HackAlem prep kit | source | Layout, placeholder page, health endpoint | 2026-09-23T07:58Z | `f30c1707cd46aa85` |
| `app/layout.tsx` | HackAlem prep kit | source | Layout, placeholder page, health endpoint | 2026-09-23T07:58Z | `f475ac7e8c1dd3ba` |
| `app/page.tsx` | HackAlem prep kit | source | Layout, placeholder page, health endpoint | 2026-09-23T07:58Z | `a10414279b6b2a2c` |
| `tests/smoke.test.ts` | HackAlem prep kit | source | Smoke test proving the toolchain works | 2026-09-23T07:58Z | `81a14d3f8e5d6a27` |
| `e2e/golden-path.spec.ts` | HackAlem prep kit | source | Playwright golden-path starter | 2026-09-23T07:58Z | `703ba2964909448b` |
| `playwright.config.ts` | HackAlem prep kit | config | E2E config (testDir e2e/, auto-starts the app) | 2026-09-23T07:58Z | `c89451f1937a4bf4` |
| `public/.gitkeep` | HackAlem prep kit | config | Keeps public/ tracked so the Docker COPY succeeds | 2026-09-23T07:58Z | `e7b97f7eec0c63ee` |
| `lib/ai/env.ts` | HackAlem prep kit | source | Provider abstraction, offline model, structured output | 2026-09-23T07:58Z | `181021da818f1a9b` |
| `lib/ai/mock-provider.ts` | HackAlem prep kit | source | Provider abstraction, offline model, structured output | 2026-09-23T07:58Z | `c9c5fe43cd951118` |
| `lib/ai/provider.ts` | HackAlem prep kit | source | Provider abstraction, offline model, structured output | 2026-09-23T07:58Z | `484b0c36d872dba1` |
| `lib/ai/scenarios.ts` | HackAlem prep kit | source | Provider abstraction, offline model, structured output | 2026-09-23T07:58Z | `126f27fa87e7fe9d` |
| `lib/ai/structured.ts` | HackAlem prep kit | source | Provider abstraction, offline model, structured output | 2026-09-23T07:58Z | `19ae917dacc774bd` |
| `lib/audit/audit.ts` | HackAlem prep kit | source | Append-only audit events | 2026-09-23T07:58Z | `ec467e1665f25fc5` |
| `lib/rules/engine.ts` | HackAlem prep kit | source | Deterministic decision engine | 2026-09-23T07:58Z | `1c64c2b3ef72e232` |
| `lib/trace/trace.ts` | HackAlem prep kit | source | Operational agent trace | 2026-09-23T07:58Z | `cee17c52f3a70ef6` |
| `lib/http/validate.ts` | HackAlem prep kit | source | Request validation and error envelope | 2026-09-23T07:58Z | `ae457e2699142194` |
| `lib/store/jsonl.ts` | HackAlem prep kit | source | File-backed storage | 2026-09-23T07:58Z | `67ac6591d8a115f6` |
| `lib/i18n/i18n.ts` | HackAlem prep kit | source | kk/ru/en dictionary helper | 2026-09-23T07:58Z | `2937e98c9e536870` |

## B. Written during the competition

Everything not listed in section A was written after the official start.
Development history in this repository is the evidence.

## C. Third-party dependencies

| Name | Version | License | Purpose |
| --- | --- | --- | --- |
| @ai-sdk/anthropic | 4.0.58 | see package | |
| @ai-sdk/openai | 4.0.71 | see package | |
| @ai-sdk/provider | 4.0.17 | see package | |
| ai | 7.0.107 | see package | |
| next | 16.3.5 | see package | |
| react | 19.3.0 | see package | |
| react-dom | 19.3.0 | see package | |
| zod | 4.6.5 | see package | |
| @biomejs/biome | 2.5.14 | see package | |
| @playwright/test | 1.63.0 | see package | |
| @tailwindcss/postcss | 4.3.3 | see package | |
| @types/node | 26.6.2 | see package | |
| @types/react | 19.3.0 | see package | |
| @types/react-dom | 19.3.0 | see package | |
| promptfoo | 0.123.1 | see package | |
| tailwindcss | 4.3.3 | see package | |
| typescript | 7.0.2 | see package | |
| vitest | 5.0.1 | see package | |

## D. Models and datasets

| Name | Provider | Usage | Notes |
| --- | --- | --- | --- |
| gpt-4o-mini (optional) | OpenAI | Phrases explanations only when `MODEL_REF=openai:gpt-4o-mini` and a key are set; default is the offline mock | Verification run: `docs/live-llm-run.md` |
| Career Quest starter kit | Halyk Bank / HackAlem organizers | Default dataset | See the organizer section below |

All demo data in this repository is synthetic and fictional.
No real personal data is present.

## E. Provided by the organizer during the competition

| Path | Source | Category | Purpose | Added |
| --- | --- | --- | --- | --- |
| `docs/task/career_quest_dataset/` | Halyk Bank Career Quest starter kit (HackAlem AI 2026) | synthetic dataset | Default dataset: 200 employees, 40 events, 60 skills, 24 months of history. Kept inside the organizer's private repository; not redistributed elsewhere. | 2026-09-23 |
| `docs/task/halyk-career-quest-spec.txt` | Halyk Bank task specification (HackAlem AI 2026) | task text | Requirements source | 2026-09-23 |
| `data/seed/` | Generated by `scripts/gen-seed.mjs` (our code) | synthetic dataset | Small fictional fallback dataset used by unit/e2e tests | 2026-09-23 |
