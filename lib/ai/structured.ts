/**
 * The only sanctioned way to get data out of a model.
 *
 * A model returns text; the rest of the system requires a validated object.
 * This is that trust boundary: nothing downstream sees unvalidated model output.
 */
import { generateText, Output } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { z } from "zod";

export interface StructuredRequest<T extends z.ZodType> {
  model: LanguageModelV4;
  schema: T;
  instructions: string;
  prompt: string;
  /** One retry by default: models occasionally emit a stray prose preamble. */
  maxAttempts?: number;
}

export interface StructuredResult<T> {
  data: T;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number };
}

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export async function generateStructured<T extends z.ZodType>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<z.infer<T>>> {
  const maxAttempts = request.maxAttempts ?? 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await generateText({
        model: request.model,
        instructions: request.instructions,
        prompt: request.prompt,
        output: Output.object({ schema: request.schema }),
      });

      // generateText already applied the schema, but we re-validate so the
      // returned value is one this codebase's zod instance vouches for.
      const data = request.schema.parse(result.output);
      return {
        data,
        attempts: attempt,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new StructuredOutputError(
    `Model did not return output matching the schema after ${maxAttempts} attempt(s).`,
    maxAttempts,
    lastError,
  );
}
