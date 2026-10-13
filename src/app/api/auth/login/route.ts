import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { LOGIN_COOKIE, startLogin } from "@/server/auth/oidc";
import { currentUser } from "@/server/auth/current-user";
import { env } from "@/server/env";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function GET(request: Request) {
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const appUrl = env().APP_URL;
  // Errors keep the return path, so trying again still ends on the page the user asked for.
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}&next=${encodeURIComponent(next)}`, appUrl), 303);
  if (!allow(clientIp(request))) return fail("rate_limited");
  if (await currentUser()) return NextResponse.redirect(new URL(next, appUrl), 303);
  try {
    const { url, cookie, maxAge } = await startLogin(next);
    const response = NextResponse.redirect(url, 303);
    response.cookies.set(LOGIN_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https:"),
      path: "/api/auth",
      maxAge,
    });
    return response;
  } catch (error) {
    console.error("Could not start login", error);
    return fail("provider_unavailable");
  }
}
