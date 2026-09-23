import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Scoped to tests/ so Vitest never collects the Playwright specs in e2e/.
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    environment: "node",
    // Every test runs against the deterministic offline model, so the suite
    // passes with no credentials on any machine - including a judge's.
    env: { MODEL_REF: "mock:demo" },
  },
  resolve: {
    // Vitest does NOT read tsconfig `paths`. Without this alias, "@/lib/..."
    // imports resolve in the editor and in `next build` but fail at test time.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
