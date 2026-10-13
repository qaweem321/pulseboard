import { cookies } from "next/headers";
import { logoutUrl } from "@/server/auth/oidc";
import { deleteSession, findSession, SESSION_COOKIE } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { redirectPage } from "@/server/http/redirect-page";

// POST only, so a link or image on another site can't sign people out.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env().APP_URL).origin) return new Response("Forbidden", { status: 403 });

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = token ? await findSession(db(), token) : null;
  if (token) await deleteSession(db(), token);
  jar.delete(SESSION_COOKIE);

  // Also end the Keycloak session, or the next "Sign in" would log straight back in.
  let target = "/";
  try {
    target = (await logoutUrl(session?.idToken ?? null)).toString();
  } catch (error) {
    console.error("Could not reach the identity provider for logout", error);
  }
  return redirectPage(target);
}
