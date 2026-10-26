import { describe, expect, it } from "vitest";

import type { Regular } from "@/lib/finance/recurring";
import { subscriptionPicture } from "@/lib/finance/subscriptions";

const regular = (over: Partial<Regular>): Regular => ({
  key: over.name ?? "x",
  name: "Netflix",
  kind: "subscription",
  direction: "out",
  cadence: "monthly",
  amount: 649,
  fixedAmount: true,
  perMonth: 649,
  count: 3,
  confidence: "high",
  last: { date: "2026-09-10", amount: 649 },
  next: "2026-10-10",
  status: "upcoming",
  seen: [
    { id: "c", date: "2026-09-10", amount: 649 },
    { id: "b", date: "2026-08-10", amount: 649 },
    { id: "a", date: "2026-07-10", amount: 649 },
  ],
  ...over,
});

describe("subscriptionPicture", () => {
  it("adds up the running ones a month and a year, and keeps the stopped ones apart", () => {
    const picture = subscriptionPicture([
      {
        currency: "INR",
        regular: [
          regular({}),
          regular({
            name: "Spotify",
            key: "sp",
            amount: 119,
            perMonth: 119,
            seen: [
              { id: "s1", date: "2026-09-01", amount: 119 },
              { id: "s2", date: "2026-08-01", amount: 119 },
            ],
            count: 2,
          }),
          regular({
            name: "Hotstar",
            key: "hs",
            amount: 299,
            perMonth: 299,
            status: "stopped",
            missedSince: "2026-08-15",
            next: "2026-08-15",
            seen: [{ id: "h1", date: "2026-07-15", amount: 299 }],
            count: 1,
          }),
          regular({ name: "Rent", key: "r", kind: "rent", amount: 15000, perMonth: 15000 }),
          regular({ name: "Salary", key: "sal", kind: "income", direction: "in", amount: 60000, perMonth: 60000 }),
        ],
      },
    ]);
    expect(picture.active.map((s) => s.name)).toEqual(["Netflix", "Spotify"]);
    expect(picture.stopped.map((s) => s.name)).toEqual(["Hotstar"]);
    expect(picture.monthly).toBe(768);
    expect(picture.yearly).toBe(9216);
    expect(picture.paid).toBe(649 * 3 + 119 * 2 + 299);
    expect(picture.active[0]).toMatchObject({ since: "2026-07-10", last: "2026-09-10", next: "2026-10-10", count: 3, paid: 1947 });
    expect(picture.stopped[0].next).toBeUndefined();
    expect(picture.currency).toBe("INR");
  });

  it("is empty when nothing is a subscription", () => {
    const picture = subscriptionPicture([{ currency: "INR", regular: [regular({ kind: "emi" })] }]);
    expect(picture).toMatchObject({ active: [], stopped: [], monthly: 0, yearly: 0, paid: 0 });
  });
});
