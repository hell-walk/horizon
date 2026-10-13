import { describe, expect, it } from "vitest";

import { progressAt } from "@/components/loaders";

// The page-load ring cannot know how much is left, so it follows how long loads
// usually take: most of the way quickly, then slower, and never 100% early.
describe("progress ring", () => {
  it("rises, slows down, and stops short of 100 until the page really arrives", () => {
    const expected = 1200;
    const at = (ms: number) => progressAt(ms, expected);
    expect(at(0)).toBe(0);
    expect(at(300)).toBeGreaterThan(40); // quick start
    expect(at(expected)).toBeGreaterThan(85); // close by the usual time
    expect(at(expected * 3)).toBeLessThan(95); // but never done on its own
    let last = -1;
    for (let ms = 0; ms <= 5000; ms += 50) {
      expect(at(ms)).toBeGreaterThanOrEqual(last);
      last = at(ms);
    }
  });

  it("a device where loads take longer fills more slowly", () => {
    expect(progressAt(500, 4000)).toBeLessThan(progressAt(500, 1000));
  });
});
