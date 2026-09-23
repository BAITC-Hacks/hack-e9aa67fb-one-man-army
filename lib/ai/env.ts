/**
 * Normalizes environment variables before any provider module evaluates.
 *
 * Why this file exists, and why it must be imported first:
 *
 * Provider packages construct a default client at module scope - `@ai-sdk/openai`
 * runs `createOpenAI()` on import, reading OPENAI_BASE_URL from the environment.
 * A `.env` line of `OPENAI_BASE_URL=` yields an EMPTY STRING, not an absent
 * variable, and an empty baseURL makes that import throw:
 *
 *   AI_InvalidArgumentError: baseURL must be a non-empty string.
 *
 * Since `cp .env.example .env` is the documented first step for judges, an empty
 * optional variable would break the very first run, on every machine, even in
 * offline mode where the provider is never used.
 *
 * ES modules evaluate imports in source order, so importing this module before
 * the provider packages guarantees the cleanup happens first.
 */

/** Optional variables where "" must mean "not set". */
const OPTIONAL_VARS = [
  "OPENAI_BASE_URL",
  "ANTHROPIC_BASE_URL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

for (const key of OPTIONAL_VARS) {
  const value = process.env[key];
  if (value !== undefined && value.trim() === "") {
    delete process.env[key];
  }
}

export {};
