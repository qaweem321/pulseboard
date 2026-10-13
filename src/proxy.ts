import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/safe-next";

// Cheap, optimistic checks only. The real session check happens in the dashboard layout and in
// every API route, against the database.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("pb_session");

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return withSecurityHeaders(NextResponse.redirect(new URL(loginPath(pathname + search), request.url)));
  }

  // Lets server components build "come back here after login" links.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);
  return withSecurityHeaders(NextResponse.next({ request: { headers } }));
}

function withSecurityHeaders(response: NextResponse) {
  const issuer = process.env.OIDC_ISSUER ? new URL(process.env.OIDC_ISSUER).origin : "";
  response.headers.set(
    "Content-Security-Policy",
    // form-action must allow the identity provider: logout and login redirect there.
    `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' ${issuer}`.trim(),
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.APP_URL?.startsWith("https:")) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health).*)"],
};
