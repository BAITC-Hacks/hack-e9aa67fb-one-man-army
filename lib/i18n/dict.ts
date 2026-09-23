/**
 * UI string dictionary (Batch 0 stub). Filled in by T4 with kk/ru/en keys
 * that share an identical key set (tests/i18n-keys.test.ts enforces this).
 */
import type { Locale } from "../i18n/i18n";

export const dict: Record<Locale, Record<string, string>> = {
  en: {},
  ru: {},
  kk: {},
};

/** Looks up `key` in `locale`, falling back to the raw key. */
export function t(locale: Locale, key: string): string {
  return dict[locale][key] ?? key;
}
