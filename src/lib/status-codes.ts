// "200-299,301" -> accepts 200..299 and 301. Shared by the form (validation) and the checker.
export type StatusRanges = ReadonlyArray<readonly [number, number]>;

export function parseStatusRanges(input: string): StatusRanges | null {
  const parts = input.split(",").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part === "")) return null;
  const ranges: Array<[number, number]> = [];
  for (const part of parts) {
    const match = /^(\d{3})(?:-(\d{3}))?$/.exec(part);
    if (!match) return null;
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    if (from < 100 || to > 599 || from > to) return null;
    ranges.push([from, to]);
  }
  return ranges;
}

export function statusMatches(ranges: StatusRanges, status: number): boolean {
  return ranges.some(([from, to]) => status >= from && status <= to);
}
