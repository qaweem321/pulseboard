import { clientIp, createRateLimiter } from "./rate-limit";

test("allows `limit` hits per window per key", () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
  expect([allow("a", 0), allow("a", 10), allow("a", 20), allow("b", 20)]).toEqual([true, true, false, true]);
  expect(allow("a", 1000)).toBe(true);
});

test("clientIp reads the address the proxy appended, not the client-supplied ones", () => {
  const request = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" } });
  expect(clientIp(request)).toBe("203.0.113.9");
  expect(clientIp(new Request("http://x"))).toBe("local");
});
