import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasRole, type Role } from "@/lib/roles";
import { db } from "../db";
import { env } from "../env";
import { findSession, SESSION_COOKIE, type SessionUser } from "../auth/sessions";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

type Context<P> = { request: Request; user: SessionUser; params: P };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Wraps a route handler with auth, role checks, CSRF checks and consistent JSON errors.
export function apiRoute<P = Record<string, never>>(
  required: Role,
  handler: (context: Context<P>) => Promise<Response>,
) {
  return async (request: Request, segment: { params: Promise<P> }) => {
    try {
      // Cookies are SameSite=Lax already; checking Origin also stops same-site attackers.
      if (!SAFE_METHODS.has(request.method)) {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(env().APP_URL).origin)
          throw new HttpError(403, "Cross-origin request");
      }
      const token = request.headers
        .get("cookie")
        ?.split(/;\s*/)
        .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
      const user = token ? await findSession(db(), token) : null;
      if (!user) throw new HttpError(401, "Your session has expired. Please sign in again.");
      if (!hasRole(user.role, required)) throw new HttpError(403, `This needs the ${required} role.`);
      return await handler({ request, user, params: await segment.params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) {
    return json(
      { error: "Please fix the highlighted fields.", fields: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(error);
  return json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw notFound();
  return id;
}
