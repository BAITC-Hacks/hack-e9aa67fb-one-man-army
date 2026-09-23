import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/i18n";
import "./globals.css";

// Replace with the real product name once the challenge is known.
export const metadata: Metadata = {
  title: "HackAlem submission",
  description: "Replace with a one-sentence description of the solution.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
