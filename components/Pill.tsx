/** Small coloured pill for a status word. Never colour alone: an icon glyph precedes the text. */
export type PillTone = "critical" | "regular" | "met" | "neutral";

const TONE_STYLE: Record<PillTone, { bg: string; text: string; border: string; icon: string }> = {
  critical: { bg: "var(--color-critical-bg)", text: "var(--color-critical-text)", border: "var(--color-critical-border)", icon: "●" },
  regular: { bg: "var(--color-regular-bg)", text: "var(--color-regular-text)", border: "var(--color-regular-border)", icon: "●" },
  met: { bg: "var(--color-met-bg)", text: "var(--color-met-text)", border: "var(--color-met-border)", icon: "✓" },
  neutral: { bg: "var(--color-neutral-bg)", text: "var(--color-neutral-text)", border: "var(--color-line)", icon: "i" },
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const style = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      <span aria-hidden="true">{style.icon}</span>
      {children}
    </span>
  );
}
