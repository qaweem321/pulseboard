import { loginPath, safeNextPath } from "./safe-next";

test.each([
  ["/dashboard/monitors/3", "/dashboard/monitors/3"],
  ["/dashboard?range=7d#chart", "/dashboard?range=7d#chart"],
  [null, "/dashboard"],
  ["", "/dashboard"],
  ["dashboard", "/dashboard"],
  ["https://evil.com", "/dashboard"],
  ["//evil.com/x", "/dashboard"],
  ["/\\evil.com", "/dashboard"],
  ["/\tevil", "/dashboard"],
  ["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
])("safeNextPath(%j) = %j", (input, expected) => {
  expect(safeNextPath(input)).toBe(expected);
});

test("loginPath encodes the return path", () => {
  expect(loginPath("/dashboard?range=7d")).toBe("/login?next=%2Fdashboard%3Frange%3D7d");
});
