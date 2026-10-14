import { fieldErrors, monitorInput, normalizeMonitorUrl, statusPageInput } from "./validation";

test("monitor input fills defaults and normalises optional text", () => {
  expect(monitorInput.parse({ name: " API ", url: "https://api.example.com/health", keyword: "  " })).toEqual(
    {
      name: "API",
      url: "https://api.example.com/health",
      method: "GET",
      expectedStatus: "200-299",
      keyword: null,
      intervalSeconds: 60,
      timeoutMs: 10_000,
      failureThreshold: 2,
    },
  );
});

test("monitor input reports every bad field", () => {
  const result = monitorInput.safeParse({
    name: "",
    url: "ftp://files.example.com",
    expectedStatus: "2xx",
    intervalSeconds: 45,
    timeoutMs: 100,
  });
  expect(result.success).toBe(false);
  expect(fieldErrors(result.error!)).toEqual({
    name: "Required",
    url: "Only http and https URLs can be monitored",
    expectedStatus: "Use codes or ranges like 200-299,301",
    intervalSeconds: "Pick one of the intervals",
    timeoutMs: "At least 1 second",
  });
});

test("monitor input rejects a URL with the scheme typed twice", () => {
  const result = monitorInput.safeParse({ name: "GitHub", url: "https://https://github.com" });
  expect(result.success).toBe(false);
  expect(fieldErrors(result.error!).url).toBe("The URL starts with http(s):// twice");
});

test("normalizeMonitorUrl adds a missing scheme and drops a doubled one", () => {
  expect(normalizeMonitorUrl(" example.com ")).toBe("https://example.com");
  expect(normalizeMonitorUrl("https://https://github.com")).toBe("https://github.com");
  expect(normalizeMonitorUrl("https://http://api.local/health")).toBe("http://api.local/health");
  expect(normalizeMonitorUrl("http://example.com")).toBe("http://example.com");
  expect(normalizeMonitorUrl("ftp://files.example.com")).toBe("ftp://files.example.com");
  expect(normalizeMonitorUrl("")).toBe("");
});

test("status page slugs are URL-safe", () => {
  expect(statusPageInput.parse({ title: "Acme", slug: "Acme-Status" }).slug).toBe("acme-status");
  expect(statusPageInput.safeParse({ title: "Acme", slug: "-acme" }).success).toBe(false);
  expect(statusPageInput.safeParse({ title: "Acme", slug: "acme/../x" }).success).toBe(false);
});
