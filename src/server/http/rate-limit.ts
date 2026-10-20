// Fixed-window counter per key, kept in memory. Good enough for one instance; put a shared store
// (Redis, Postgres) behind the same function when running several.
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, now = Date.now()): boolean {
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}

// The last X-Forwarded-For entry: the address our own reverse proxy saw. Earlier entries come from
// the client and can be anything. Without a proxy, Next.js fills the header with the socket address
// only when the client didn't send one, so production must run behind a proxy that appends to it.
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}
