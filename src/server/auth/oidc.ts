import * as client from "openid-client";
import { safeNextPath } from "@/lib/safe-next";
import { env } from "../env";
import { seal, unseal } from "./seal";

export const LOGIN_COOKIE = "pb_login";
const LOGIN_MAX_AGE = 10 * 60;

type LoginTransaction = { state: string; nonce: string; verifier: string; next: string };

export type OidcIdentity = {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  idToken: string | undefined;
};

let configPromise: Promise<client.Configuration> | undefined;

// Discovery runs once per process. A failed attempt isn't cached, so a Keycloak that starts after
// the app still works on the next login.
export function oidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET } = env();
    const issuer = new URL(OIDC_ISSUER);
    configPromise = client
      .discovery(issuer, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, undefined, {
        // Local Keycloak runs on plain http; production issuers must be https.
        execute: issuer.protocol === "http:" ? [client.allowInsecureRequests] : [],
      })
      .catch((error: unknown) => {
        configPromise = undefined;
        throw error;
      });
  }
  return configPromise;
}

export function callbackUrl() {
  return new URL("/api/auth/callback", env().APP_URL).toString();
}

// Authorization Code flow with PKCE, state and nonce. The three secrets travel in an encrypted,
// short-lived cookie instead of server memory, so any app instance can finish the login.
export async function startLogin(next: string | null) {
  const config = await oidcConfig();
  const transaction: LoginTransaction = {
    state: client.randomState(),
    nonce: client.randomNonce(),
    verifier: client.randomPKCECodeVerifier(),
    next: safeNextPath(next),
  };
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl(),
    scope: "openid email profile",
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await client.calculatePKCECodeChallenge(transaction.verifier),
    code_challenge_method: "S256",
  });
  const cookie = await seal(transaction, env().SESSION_SECRET, LOGIN_MAX_AGE);
  return { url, cookie, maxAge: LOGIN_MAX_AGE };
}

export async function finishLogin(currentUrl: URL, cookie: string | undefined) {
  const transaction = cookie ? await unseal<LoginTransaction>(cookie, env().SESSION_SECRET) : null;
  if (!transaction) throw new LoginError("Your sign-in took too long or was started in another browser.");
  const config = await oidcConfig();
  // Keycloak redirects to APP_URL; behind a proxy the request URL may differ, so rebuild it.
  const redirected = new URL(callbackUrl());
  redirected.search = currentUrl.search;
  const tokens = await client.authorizationCodeGrant(config, redirected, {
    pkceCodeVerifier: transaction.verifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims) throw new LoginError("The identity provider did not return an ID token.");
  const identity: OidcIdentity = {
    sub: claims.sub,
    email: String(claims.email ?? "").toLowerCase(),
    name: String(claims.name ?? claims.preferred_username ?? claims.email ?? "Unknown user"),
    // A protocol mapper in the realm puts realm roles into the ID token as `roles`.
    roles: Array.isArray(claims.roles) ? claims.roles.map(String) : [],
    idToken: tokens.id_token,
  };
  return { identity, next: transaction.next };
}

export async function logoutUrl(idToken: string | null) {
  const config = await oidcConfig();
  const params: Record<string, string> = { post_logout_redirect_uri: new URL("/", env().APP_URL).toString() };
  if (idToken) params.id_token_hint = idToken;
  else params.client_id = env().OIDC_CLIENT_ID;
  return client.buildEndSessionUrl(config, params);
}

export class LoginError extends Error {}
