import { describe, expect, it } from "vitest";
import { dict, t } from "@/lib/i18n/dict";
import { LOCALES } from "@/lib/i18n/i18n";

describe("i18n dictionary", () => {
  it("has an identical key set across kk, ru and en", () => {
    const [first, ...rest] = LOCALES.map((locale) => Object.keys(dict[locale]).sort());
    expect(first).toBeDefined();
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });

  it("has a non-empty, complete English dictionary", () => {
    const keys = Object.keys(dict.en);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(dict.en[key]).toBeTruthy();
    }
  });

  it("t() falls back to the raw key for a missing entry", () => {
    expect(t("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("t() resolves a known key in every locale", () => {
    for (const locale of LOCALES) {
      expect(t(locale, "app.title")).toBe(dict.en["app.title"]);
    }
  });
});
