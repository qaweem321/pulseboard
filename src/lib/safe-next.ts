export const DEFAULT_AFTER_LOGIN = "/dashboard";

// Where to send someone after login. Only same-site paths are allowed: "//evil.com" and
// "/\evil.com" are protocol-relative URLs browsers would follow off-site.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_AFTER_LOGIN;
  try {
    const url = new URL(next, "http://pulseboard.invalid");
    if (url.origin !== "http://pulseboard.invalid") return DEFAULT_AFTER_LOGIN;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}

export function loginPath(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
