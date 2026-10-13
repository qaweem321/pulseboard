import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { LOGIN_COOKIE, startLogin } from "@/server/auth/oidc";
import { currentUser } from "@/server/auth/current-user";
import { env } from "@/server/env";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function GET(request: Request) {
  const next = new URL(request.url).searchParams.get("next");
  const appUrl = env().APP_URL;
  if (!allow(clientIp(request))) {
    return NextResponse.redirect(new URL(`/login?error=rate_limited`, appUrl), 303);
  }
  if (await currentUser()) return NextResponse.redirect(new URL(safeNextPath(next), appUrl), 303);
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
    return NextResponse.redirect(new URL("/login?error=provider_unavailable", appUrl), 303);
  }
}
