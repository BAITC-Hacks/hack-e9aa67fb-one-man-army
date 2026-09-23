import { describe, expect, it } from "vitest";
import { dict } from "@/lib/i18n/dict";
import { LOCALES } from "@/lib/i18n/i18n";

/**
 * Keys legitimately identical across locales: brand name, the "HR"
 * abbreviation, the endonym for each language name, filenames the app
 * literally expects, and a string built entirely from placeholders.
 */
const ALLOW_IDENTICAL_TO_EN = new Set<string>([
  "app.title",
  "common.hr",
  "lang.en",
  "lang.kk",
  "lang.ru",
  "import.field.employees",
  "import.field.activity_history",
  "recs.blockedCount",
  "hr.suppressedChip",
]);

describe("i18n completeness", () => {
  it("has the same key set in every locale (enforced by the Dict type, checked again here)", () => {
    const [first, ...rest] = LOCALES.map((locale) => Object.keys(dict[locale]).sort());
    expect(first).toBeDefined();
    for (const keys of rest) expect(keys).toEqual(first);
  });

  it("has no empty ru or kk value", () => {
    for (const locale of ["ru", "kk"] as const) {
      for (const [key, value] of Object.entries(dict[locale])) {
        expect(value.trim(), `${locale}.${key} is empty`).not.toBe("");
      }
    }
  });

  it("translates every ru/kk value away from the English source, except the allowlist", () => {
    for (const locale of ["ru", "kk"] as const) {
      for (const [key, value] of Object.entries(dict[locale])) {
        if (ALLOW_IDENTICAL_TO_EN.has(key)) continue;
        expect(value, `${locale}.${key} is identical to en - looks untranslated`).not.toBe(dict.en[key]);
      }
    }
  });
});
