/**
 * Signed-cookie demo session (ADR-0008; docs/architecture.md §1, §6).
 *
 * Identity comes from the signed HttpOnly cookie only - never from a request
 * body, query string or header. `requireEmployeeSelf` / `requireHr` /
 * `requireSelfOrHr` throw `SessionError` (401/403) before any dataset read,
 * so a missing or forged cookie fails closed.
 *
 * The demo login itself is not authentication (anyone can pick any identity -
 * disclosed in the README per ADR-0008). What this module enforces is
 * authorization: once a role is asserted, it is cryptographically bound to
 * the cookie and cannot be changed by the client.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { errorResponse } from "../http/validate";
import { Session } from "../contracts";
import type { Session as SessionType } from "../contracts";

const COOKIE_NAME = "cq_session";
export const SESSION_COOKIE_NAME = COOKIE_NAME;

const DEV_DEFAULT_SECRET = "dev-only-insecure-secret-change-me";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    // Fails closed: a production deploy with no real secret refuses to sign
    // or verify sessions rather than silently using a public default.
    throw new Error(
      "SESSION_SECRET must be set in production. Refusing to sign or verify sessions with the dev default.",
    );
  }
  return DEV_DEFAULT_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Signs a session into the `payload.signature` cookie value. */
export function encodeSession(session: SessionType): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verifies signature with a constant-time comparison, then validates shape. Never throws. */
export function decodeSession(cookieValue: string): SessionType | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;

  try {
    const json: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const result = Session.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export async function getSession(request: Request): Promise<SessionType | null> {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return null;
  return decodeSession(raw);
}

/** Thrown by the guards below. Routes convert it to a Response via `sessionErrorResponse`. */
export class SessionError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

/** Employee-only self-access. Used by `/complete` and `/dismiss` (never on HR's behalf via this guard). */
export async function requireEmployeeSelf(request: Request, employeeId: string): Promise<SessionType> {
  const session = await getSession(request);
  if (!session) throw new SessionError(401, "UNAUTHENTICATED", "No valid session.");
  if (session.role !== "employee" || session.employeeId !== employeeId) {
    // Same 403, whether the id is foreign or simply unknown: no existence oracle.
    throw new SessionError(403, "FORBIDDEN", "Not authorized for this employee.");
  }
  return session;
}

/** HR-only. Used by `/api/hr/*`. */
export async function requireHr(request: Request): Promise<SessionType> {
  const session = await getSession(request);
  if (!session) throw new SessionError(401, "UNAUTHENTICATED", "No valid session.");
  if (session.role !== "hr") throw new SessionError(403, "FORBIDDEN", "HR only.");
  return session;
}

/** Self OR HR (HR access is a broader read, so callers audit it when `isHr` is true). */
export async function requireSelfOrHr(
  request: Request,
  employeeId: string,
): Promise<{ session: SessionType; isHr: boolean }> {
  const session = await getSession(request);
  if (!session) throw new SessionError(401, "UNAUTHENTICATED", "No valid session.");
  if (session.role === "hr") return { session, isHr: true };
  if (session.employeeId !== employeeId) {
    throw new SessionError(403, "FORBIDDEN", "Not authorized for this employee.");
  }
  return { session, isHr: false };
}

/** Converts a `SessionError` to the standard error envelope. Returns null for any other error. */
export function sessionErrorResponse(error: unknown): Response | null {
  if (error instanceof SessionError) return errorResponse(error.code, error.message, error.status);
  return null;
}

export function sessionCookieHeader(session: SessionType): string {
  const attrs = ["HttpOnly", "SameSite=Strict", "Path=/"];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return `${COOKIE_NAME}=${encodeSession(session)}; ${attrs.join("; ")}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
