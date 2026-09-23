/**
 * Trust boundary for HTTP handlers.
 *
 * Every request body crossing into domain code is parsed by a zod schema here.
 * Errors leave as a stable envelope so the UI can render them and so internal
 * messages and stack traces never reach a client.
 */
import type { z } from "zod";
import { crossOriginViolation } from "./origin";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const body: ApiError = { error: { code, message, details } };
  return Response.json(body, { status, headers: securityHeaders() });
}

export function okResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: securityHeaders() });
}

/** Applied to every API response; the page layer adds its own CSP. */
export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
}

export class ValidationFailure extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super("Request failed validation");
    this.name = "ValidationFailure";
  }
}

/** Parses and validates a JSON request body. Throws ValidationFailure. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationFailure([
      { code: "custom", path: [], message: "Body is not valid JSON" } as z.ZodIssue,
    ]);
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationFailure(result.error.issues);
  return result.data;
}

/**
 * Wraps a handler so thrown errors become safe, typed responses.
 *
 * Generic over the trailing arguments so it also wraps dynamic routes, which
 * Next.js calls as `(request, { params })`. Without this, a handler for
 * `/api/cases/[id]` cannot reach its params through the wrapper - and those are
 * exactly the routes where an authorization check matters most.
 */
export function withErrorHandling<TArgs extends unknown[]>(
  handler: (request: Request, ...args: TArgs) => Promise<Response>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    // CSRF guard (T16): fail closed on a cross-origin state-changing request,
    // before the handler reads a cookie or a body.
    if (crossOriginViolation(request)) {
      return errorResponse("CROSS_ORIGIN_FORBIDDEN", "Cross-origin request rejected", 403);
    }
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof ValidationFailure) {
        return errorResponse("invalid_request", "Request failed validation", 400, {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      // Log server-side with detail; return an opaque message to the caller.
      console.error("[api] unhandled error", error);
      return errorResponse("internal_error", "Something went wrong", 500);
    }
  };
}
