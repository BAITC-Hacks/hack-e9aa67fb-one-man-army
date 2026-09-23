import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halyk Career Quest",
  description:
    "Explainable next-step navigator for employee development: deterministic multi-factor recommendations with a visible trace.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-dvh bg-[var(--color-canvas)] font-sans text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
