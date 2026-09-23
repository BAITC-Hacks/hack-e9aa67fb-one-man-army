/**
 * Minimal Node ESM resolve hook so `eval/run.mjs` can `import` this repo's
 * own `.ts` sources directly (no build step, no ts-node/tsx dependency).
 *
 * WHY THIS EXISTS: promptfoo has no HTTP endpoint to call for the AI
 * explain/recommend pipeline (there is no `app/api/.../explain` route - the
 * pipeline is called in-process from server components), and this repo's
 * `.ts` files use extensionless relative imports (`from "../contracts"`),
 * which Node's native ESM resolver rejects even with `--experimental-strip-types`.
 * This hook only adds ".ts"/".tsx"/"/index.ts" resolution for relative
 * specifiers; combined with node's own `--experimental-transform-types`
 * flag (set on the `pnpm eval` command line), it lets `eval/run.mjs` import
 * the REAL `lib/ai/explain.ts`, `lib/ai/grounding.ts` and
 * `lib/domain/recommend.ts` - the eval exercises production code, not a
 * reimplementation of it.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
  if (isRelative && !hasExtension && context.parentURL) {
    const baseDir = dirname(fileURLToPath(context.parentURL));
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = join(baseDir, specifier + suffix);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
