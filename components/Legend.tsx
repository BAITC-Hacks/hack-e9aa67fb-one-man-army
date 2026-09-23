/**
 * Colour-semantics legend, used everywhere the app colours a gap or status,
 * so a judge (or a colour-blind user) never has to guess what a tint means -
 * every swatch carries an icon and a word, never colour alone.
 */
import type { Locale } from "@/lib/i18n/i18n";
import { t } from "@/lib/i18n/dict";

export function Legend({ locale }: { locale: Locale }) {
  const items = [
    { icon: "●", bg: "var(--color-critical-bg)", text: "var(--color-critical-text)", label: t(locale, "legend.critical") },
    { icon: "●", bg: "var(--color-regular-bg)", text: "var(--color-regular-text)", label: t(locale, "legend.regular") },
    { icon: "✓", bg: "var(--color-met-bg)", text: "var(--color-met-text)", label: t(locale, "legend.met") },
    { icon: "i", bg: "var(--color-neutral-bg)", text: "var(--color-neutral-text)", label: t(locale, "legend.neutral") },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-muted)]" aria-label={t(locale, "legend.title")}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ backgroundColor: item.bg, color: item.text }}
          >
            {item.icon}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
