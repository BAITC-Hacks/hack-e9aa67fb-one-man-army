/**
 * Three-language UI support (kk / ru / en).
 *
 * A plain dictionary rather than a routing-aware i18n framework: the whole
 * feature is a lookup and a language switch, and a hackathon cannot afford a
 * routing rewrite. Swap in next-intl only if URL-localised routes are required.
 */
export const LOCALES = ["kk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_LABELS: Record<Locale, string> = {
  kk: "Қазақша",
  ru: "Русский",
  en: "English",
};

/** Every key must exist in all three locales; the type enforces it. */
export type Dictionary = Record<string, Record<Locale, string>>;

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export function createTranslator(dictionary: Dictionary, locale: Locale) {
  return (key: keyof typeof dictionary & string): string => {
    const entry = dictionary[key];
    if (!entry) return key;
    // Falls back through ru then en rather than showing a raw key to a user.
    return entry[locale] || entry[DEFAULT_LOCALE] || entry.en || key;
  };
}
