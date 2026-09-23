/**
 * Cross-origin guard for state-changing requests (docs/threat-model.md T16).
 *
 * Applied centrally in `withErrorHandling`, so every `/api/**` POST/PUT/PATCH/
 * DELETE is covered without per-route code. Policy:
 *  - Safe methods (GET/HEAD/OPTIONS) pass.
 *  - `Sec-Fetch-Site: cross-site` -> reject (browser-asserted, cannot be forged by page JS).
 *  - `Origin` present and its host differs from the request host -> reject.
 *  - `Origin: null` (sandboxed iframe, file://) -> reject.
 *  - No Origin and no Sec-Fetch-Site -> allow (non-browser client such as curl
 *    or tests; a browser always sends Origin on cross-origin POST, and the
 *    SameSite=Strict session cookie is the second layer).
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestHost(request: Request): string | null {
  // Behind a proxy Next sets x-forwarded-host; prefer Host, which the server received.
  const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  if (host) return host.toLowerCase();
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Returns a reason string when the request must be rejected, otherwise null. */
export function crossOriginViolation(request: Request): string | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite.toLowerCase() === "cross-site") return "cross-site request";

  const origin = request.headers.get("origin");
  if (origin === null) return null;
  if (origin === "null") return "opaque origin";

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return "malformed origin";
  }
  const host = requestHost(request);
  if (!host || host !== originHost) return "origin mismatch";
  return null;
}
