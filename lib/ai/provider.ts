/**
 * Provider-neutral model resolution.
 *
 * Business logic never names a vendor. It asks for a *role* ("triage",
 * "drafting") and this module maps roles to concrete models via environment
 * variables, so swapping OpenAI -> Anthropic -> mock is a config change.
 */
// MUST stay first: clears empty-string env vars before the provider packages
// below build their module-scope default clients. See ./env.ts.
import "./env";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMockModel } from "./mock-provider";
import { scenarios } from "./scenarios";

export type ProviderId = "openai" | "anthropic" | "mock";

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export class MissingCredentialError extends Error {
  constructor(provider: ProviderId, envVar: string) {
    super(
      `Model provider "${provider}" needs ${envVar}. ` +
        `Set it in .env, or set MODEL_REF=mock:demo to run fully offline.`,
    );
    this.name = "MissingCredentialError";
  }
}

/** Parses "openai:gpt-5-mini" / "anthropic:claude-sonnet-5" / "mock:demo". */
export function parseModelRef(ref: string): ModelRef {
  const separator = ref.indexOf(":");
  if (separator === -1) {
    throw new Error(`Invalid MODEL_REF "${ref}". Expected "<provider>:<model>".`);
  }
  const provider = ref.slice(0, separator) as ProviderId;
  const model = ref.slice(separator + 1);
  if (!["openai", "anthropic", "mock"].includes(provider)) {
    throw new Error(`Unknown provider "${provider}" in MODEL_REF "${ref}".`);
  }
  if (!model) throw new Error(`MODEL_REF "${ref}" is missing a model name.`);
  return { provider, model };
}

/**
 * Resolves a model reference to a live client.
 *
 * Fails closed: a provider without its key throws a named error rather than
 * silently degrading to the mock, so a misconfigured deployment is loud.
 */
export function resolveModel(ref: string = defaultModelRef()): LanguageModelV4 {
  const { provider, model } = parseModelRef(ref);

  switch (provider) {
    case "mock":
      // No fallback on purpose: an unmatched prompt raises NoMockScenarioError,
      // which the caller's degraded path handles. See ./scenarios.ts.
      return createMockModel(model, { scenarios });

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new MissingCredentialError("openai", "OPENAI_API_KEY");
      return createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined })(model);
    }

    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new MissingCredentialError("anthropic", "ANTHROPIC_API_KEY");
      return createAnthropic({ apiKey, baseURL: process.env.ANTHROPIC_BASE_URL || undefined })(model);
    }
  }
}

export function defaultModelRef(): string {
  return process.env.MODEL_REF ?? "mock:demo";
}

/** True when the app is running without any paid credentials. */
export function isOfflineMode(): boolean {
  return parseModelRef(defaultModelRef()).provider === "mock";
}
