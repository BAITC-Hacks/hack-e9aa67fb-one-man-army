import { describe, it, expect } from "vitest";
import { isOfflineMode, parseModelRef } from "@/lib/ai/provider";

/**
 * Proves the toolchain works end to end before any feature exists: the alias
 * resolves, the spine imports, and the app defaults to the offline model.
 * Replace with real tests as requirements land - do not delete until then, or
 * `pnpm test` fails with "no test files found".
 */
describe("scaffold smoke test", () => {
  it("defaults to the offline model so the repo runs with no credentials", () => {
    expect(isOfflineMode()).toBe(true);
  });

  it("resolves the @/ path alias to the spine", () => {
    expect(parseModelRef("mock:demo").provider).toBe("mock");
  });
});
