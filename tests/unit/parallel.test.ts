import { describe, expect, it } from "vitest";

import { mapWithLimit } from "@/lib/parallel";

describe("mapWithLimit", () => {
  it("keeps the order, never runs more than the limit at once, and is faster than one by one", async () => {
    let running = 0;
    let most = 0;
    const t0 = Date.now();
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8], 4, async (n) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 40));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(most).toBe(4);
    expect(Date.now() - t0).toBeLessThan(8 * 40); // two rounds of four, not eight in a row
  });

  it("handles nothing and a limit above the count", async () => {
    expect(await mapWithLimit([], 6, async (n) => n)).toEqual([]);
    expect(await mapWithLimit([1, 2], 6, async (n) => n + 1)).toEqual([2, 3]);
  });
});
