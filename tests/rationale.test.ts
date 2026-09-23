/**
 * R-04 rationale coverage (the final review #2/#4): every SHOWN
 * recommendation's template explanation cites >=3 distinct factor kinds
 * (checked the same way explain.ts decides mock/llm vs fallback -
 * groundingCheck) and never leaks a raw SK_* id, in en/ru/kk.
 */
import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { templateExplanation } from "@/lib/ai/template";
import { groundingCheck } from "@/lib/ai/grounding";
import type { Locale } from "@/lib/contracts";

const LOCALES: Locale[] = ["en", "ru", "kk"];

describe("rationale coverage across the shipped kit (R-04)", () => {
  it("every shown recommendation's explanation cites >=3 factor kinds and never a raw SK_ id, in en/ru/kk", async () => {
    const ds = await getDataset();
    let checked = 0;
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      for (const rec of result.recommendations) {
        for (const locale of LOCALES) {
          const exp = templateExplanation(rec, locale, "test");
          const text = [exp.headline, ...exp.why, exp.expected_progress].join("\n");
          expect(text).not.toContain("SK_");
          const grounding = groundingCheck(text, { factors: rec.factors, expected: rec.expected });
          expect(grounding.grounded).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
