import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { finishLogin, LOGIN_COOKIE, LoginError } from "@/server/auth/oidc";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";
import { redirectPage } from "@/server/http/redirect-page";

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function GET(request: Request) {
  const appUrl = env().APP_URL;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, appUrl), 303);
  if (!allow(clientIp(request))) return fail("rate_limited");

  const url = new URL(request.url);
  // The user pressed "Cancel" on the Keycloak page, or Keycloak refused the request.
  if (url.searchParams.has("error")) return fail("cancelled");

  const jar = await cookies();
  try {
    const { identity, next } = await finishLogin(url, jar.get(LOGIN_COOKIE)?.value);
    const { token } = await createSession(db(), identity);
    jar.delete({ name: LOGIN_COOKIE, path: "/api/auth" });
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https:"),
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return redirectPage(next);
  } catch (error) {
    console.error("Login failed", error);
    return fail(error instanceof LoginError ? "expired" : "failed");
  }
}
