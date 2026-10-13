import { mapLimit } from "./concurrency";

test("mapLimit keeps order and never exceeds the limit", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, n));
    active--;
    return n * 10;
  });
  expect(result).toEqual([50, 10, 40, 20, 30]);
  expect(peak).toBe(2);
});

test("mapLimit handles an empty list", async () => {
  expect(await mapLimit([], 3, async () => 1)).toEqual([]);
});
