/**
 * Deterministic offline language model.
 *
 * Why this exists: judges run the repo without our API keys, and a hackathon
 * network is unreliable. Every test, the seeded demo and the clean-room check
 * run against this provider, so behaviour is byte-identical on any machine.
 * Live providers are an opt-in upgrade, never a requirement to see the product.
 */
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

/** A scripted answer. The first scenario whose `match` returns true wins. */
export interface MockScenario {
  name: string;
  match: (prompt: string, options: LanguageModelV4CallOptions) => boolean;
  /** Plain text, a JSON-serialisable object (for structured output), or a tool call. */
  respond: (prompt: string, options: LanguageModelV4CallOptions) => MockReply;
}

export type MockReply =
  | { kind: "text"; text: string }
  | { kind: "object"; value: unknown }
  | { kind: "tool-call"; toolName: string; input: unknown };

export interface MockProviderOptions {
  scenarios: MockScenario[];
  /**
   * Used when no scenario matches. Optional on purpose: with no fallback the
   * model raises NoMockScenarioError, which a degraded path can catch. Returning
   * prose here would leak a developer note into the UI and break any structured
   * schema - see the note in ./scenarios.ts.
   */
  fallback?: (prompt: string) => MockReply;
}

/**
 * Raised when the offline model is asked something no scenario covers.
 *
 * This is an expected condition, not a bug: a judge typing their own sentence
 * will reach it. Catch it and render your "cannot determine this yet" state.
 */
export class NoMockScenarioError extends Error {
  constructor(
    readonly modelId: string,
    readonly promptExcerpt: string,
  ) {
    super(
      `No offline scenario matched for model "${modelId}". ` +
        `Add one in lib/ai/scenarios.ts, or handle this as an undetermined result.`,
    );
    this.name = "NoMockScenarioError";
  }
}

/**
 * Flattens the call prompt into plain text so scenarios can match on it.
 *
 * System messages are EXCLUDED by default, and that default matters. The
 * `instructions` you pass to generateText arrive here as a system message, so
 * including them would let a scenario match on words from your own prompt
 * ("classify the safety hazard") rather than from the user's input - producing
 * confident, wrong, and very hard to debug behaviour.
 */
export function promptText(
  options: LanguageModelV4CallOptions,
  { includeSystem = false }: { includeSystem?: boolean } = {},
): string {
  const parts: string[] = [];
  for (const message of options.prompt) {
    if (!includeSystem && message.role === "system") continue;
    if (typeof message.content === "string") {
      parts.push(message.content);
      continue;
    }
    for (const part of message.content) {
      if (part.type === "text") parts.push(part.text);
    }
  }
  return parts.join("\n");
}

/** The system instructions only. Useful for scenarios that key off the task. */
export function instructionsText(options: LanguageModelV4CallOptions): string {
  const parts: string[] = [];
  for (const message of options.prompt) {
    if (message.role !== "system") continue;
    if (typeof message.content === "string") parts.push(message.content);
  }
  return parts.join("\n");
}

function render(reply: MockReply): LanguageModelV4Content[] {
  switch (reply.kind) {
    case "text":
      return [{ type: "text", text: reply.text }];
    case "object":
      return [{ type: "text", text: JSON.stringify(reply.value) }];
    case "tool-call":
      return [
        {
          type: "tool-call",
          toolCallId: `mock-${reply.toolName}`,
          toolName: reply.toolName,
          input: JSON.stringify(reply.input),
        },
      ];
  }
}

export function createMockModel(
  modelId: string,
  options: MockProviderOptions,
): LanguageModelV4 {
  const resolve = (callOptions: LanguageModelV4CallOptions): MockReply => {
    const text = promptText(callOptions);
    const hit = options.scenarios.find((s) => s.match(text, callOptions));
    if (hit) return hit.respond(text, callOptions);
    if (options.fallback) return options.fallback(text);
    // Fail loudly and catchably rather than emitting prose that would fail a
    // schema, or land a developer note on a citizen-facing page.
    throw new NoMockScenarioError(modelId, text.slice(0, 80));
  };

  // The offline model bills nothing; report zeroed usage in the v4 shape.
  const usage: LanguageModelV4Usage = {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  };
  const finishReason: LanguageModelV4FinishReason = { unified: "stop", raw: "stop" };

  return {
    specificationVersion: "v4",
    provider: "mock",
    modelId,
    supportedUrls: {},

    async doGenerate(callOptions) {
      return {
        content: render(resolve(callOptions)),
        finishReason,
        usage,
        warnings: [],
      };
    },

    async doStream(callOptions) {
      const content = render(resolve(callOptions));
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const [index, part] of content.entries()) {
              const id = String(index);
              if (part.type === "text") {
                controller.enqueue({ type: "text-start", id });
                controller.enqueue({ type: "text-delta", id, delta: part.text });
                controller.enqueue({ type: "text-end", id });
              } else if (part.type === "tool-call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                });
              }
            }
            controller.enqueue({ type: "finish", finishReason, usage });
            controller.close();
          },
        }),
      };
    },
  };
}
