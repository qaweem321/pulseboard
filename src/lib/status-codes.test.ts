import { parseStatusRanges, statusMatches } from "./status-codes";

describe("parseStatusRanges", () => {
  it.each([
    ["200", [[200, 200]]],
    ["200-299", [[200, 299]]],
    [
      "200-299, 301,302",
      [
        [200, 299],
        [301, 301],
        [302, 302],
      ],
    ],
  ])("parses %s", (input, expected) => {
    expect(parseStatusRanges(input)).toEqual(expected);
  });

  it.each(["", "2xx", "200-", "299-200", "99", "600", "200,,301", "200;301"])("rejects %j", (input) => {
    expect(parseStatusRanges(input)).toBeNull();
  });
});

test("statusMatches checks every range", () => {
  const ranges = parseStatusRanges("200-299,301")!;
  expect(statusMatches(ranges, 204)).toBe(true);
  expect(statusMatches(ranges, 301)).toBe(true);
  expect(statusMatches(ranges, 302)).toBe(false);
  expect(statusMatches(ranges, 500)).toBe(false);
});
