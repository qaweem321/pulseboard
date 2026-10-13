import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { runCheck, type CheckTarget } from "./check";

let server: Server;
let base: string;
const local = { allowHosts: ["127.0.0.1"], allowHttp: true };

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/ok") return res.end("all systems operational");
    if (req.url === "/error") {
      res.statusCode = 503;
      return res.end("maintenance");
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/ok" });
      return res.end();
    }
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 500);
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const target = (path: string, extra: Partial<CheckTarget> = {}): CheckTarget => ({
  url: base + path,
  method: "GET",
  expectedStatus: "200-299",
  keyword: null,
  timeoutMs: 2_000,
  ...extra,
});

describe("runCheck", () => {
  it("passes on an expected status and measures the response time", async () => {
    const outcome = await runCheck(target("/ok"), local);
    expect(outcome).toMatchObject({ ok: true, statusCode: 200, error: null });
    expect(outcome.responseMs).toBeGreaterThanOrEqual(0);
  });

  it("fails on an unexpected status", async () => {
    expect(await runCheck(target("/error"), local)).toMatchObject({
      ok: false,
      statusCode: 503,
      error: "Unexpected status 503",
    });
  });

  it("accepts custom status ranges", async () => {
    expect((await runCheck(target("/error", { expectedStatus: "200-299,503" }), local)).ok).toBe(true);
  });

  it("follows redirects", async () => {
    expect(await runCheck(target("/redirect"), local)).toMatchObject({ ok: true, statusCode: 200 });
  });

  it("checks the keyword", async () => {
    expect((await runCheck(target("/ok", { keyword: "operational" }), local)).ok).toBe(true);
    expect(await runCheck(target("/ok", { keyword: "outage" }), local)).toMatchObject({
      ok: false,
      error: 'Keyword "outage" not found',
    });
  });

  it("times out slow responses", async () => {
    const outcome = await runCheck(target("/slow", { timeoutMs: 100 }), local);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/timed out/i);
  });

  it("blocks private addresses unless they are allowed (SSRF protection)", async () => {
    const outcome = await runCheck(target("/ok"), { allowHosts: [], allowHttp: true });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/^Blocked by network policy/);
  });

  it("can require https", async () => {
    const outcome = await runCheck(target("/ok"), { allowHosts: ["127.0.0.1"], allowHttp: false });
    expect(outcome.error).toMatch(/^Blocked by network policy/);
  });

  it("reports an invalid expected status instead of throwing", async () => {
    expect((await runCheck(target("/ok", { expectedStatus: "2xx" }), local)).error).toBe(
      'Invalid expected status "2xx"',
    );
  });
});
