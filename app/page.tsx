/**
 * PLACEHOLDER. Replace entirely once the challenge is known.
 *
 * It exists so that `pnpm build` and `pnpm dev` are green from the first minute,
 * and so the health endpoint has an app to live in.
 */
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Project scaffold</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        The application builds and runs. Replace this page with the golden-path
        screen for the challenge.
      </p>
      <p className="mt-6 text-sm">
        Health check:{" "}
        <a className="text-[var(--color-accent)] underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
