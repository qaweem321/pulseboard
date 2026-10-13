// A tiny page that navigates with location.replace(): the login/logout step is removed from
// history, so the Back button can't land on a stale signed-in or signed-out page.
export function redirectPage(url: string, init: ResponseInit & { headers?: Headers } = {}) {
  const target = JSON.stringify(url).replace(/</g, "\\u003c");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html><meta charset="utf-8"><title>Redirecting…</title>
<meta http-equiv="refresh" content="0;url=${escaped}">
<script>location.replace(${target})</script>`;
  const headers = init.headers ?? new Headers();
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(html, { ...init, headers });
}
