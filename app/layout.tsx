import type { Metadata } from "next";
import "./globals.css";

// Replace with the real product name once the challenge is known.
export const metadata: Metadata = {
  title: "HackAlem submission",
  description: "Replace with a one-sentence description of the solution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
