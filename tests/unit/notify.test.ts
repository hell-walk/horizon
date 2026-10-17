import { describe, expect, it } from "vitest";

import type { HeadsUpResult } from "@/lib/headsUp";
import { isPushEndpoint, markSent, readNotify, readPushSubscription, reminderFor, withDevice } from "@/lib/notify";

const account = { id: "a1", name: "HDFC Bank", mask: "4821", currency: "INR" };
const emi = (date: string, days: number) => ({ kind: "emi" as const, account, lender: "HDFC Bank", amount: 12000, fixed: true, date, days });
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

describe("push endpoints", () => {
  it("accepts only the browsers' push services, over https", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QGuQ")).toBe(true);
    expect(isPushEndpoint("https://db5p.notify.windows.com/w/?token=abc")).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/x",
      "https://evil.example/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest",
      42,
      null,
    ]) {
      expect(isPushEndpoint(bad), String(bad)).toBe(false);
    }
  });

  it("reads a browser subscription, refusing anything malformed", () => {
    expect(readPushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }, 5)).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys,
      added: 5,
    });
    expect(readPushSubscription({ endpoint: "https://evil.example/x", keys })).toBeNull();
    expect(readPushSubscription({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "<script>", auth: keys.auth } })).toBeNull();
  });
});

describe("stored settings", () => {
  it("are off by default and read defensively", () => {
    expect(readNotify(undefined)).toEqual({ email: false, push: [], locale: "en", localeChosen: false, sent: [] });
    expect(readNotify({ email: "yes", locale: "xx", push: [{ endpoint: "https://evil.example" }], sent: [1, "emi:a:b"] })).toEqual({
      email: false,
      push: [],
      locale: "en",
      localeChosen: false,
      sent: ["emi:a:b"],
    });
  });

  it("keep at most five devices, the newest", () => {
    let s = readNotify(undefined);
    for (let i = 0; i < 7; i++) s = withDevice(s, { endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, keys, added: i });
    expect(s.push.map((p) => p.added)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("what to send today", () => {
  const result = (items: HeadsUpResult["items"]): HeadsUpResult => ({ items, staleSince: null });

  it("an EMI two days away, once", () => {
    const r = reminderFor(result([emi("2026-10-05", 2)]), []);
    expect(r).toEqual({ kind: "emi", count: 1, keys: ["emi:a1:2026-10-05"] });
    expect(reminderFor(result([emi("2026-10-05", 1)]), markSent([], r!.keys))).toBeNull();
  });

  it("not yet when the EMI is a week away", () => {
    expect(reminderFor(result([emi("2026-10-10", 7)]), [])).toBeNull();
  });

  it("a shortfall goes before everything", () => {
    const short = { kind: "shortfall" as const, account, balance: 5000, needed: 12000, asOf: "2026-09-30" };
    expect(reminderFor(result([short, emi("2026-10-05", 2)]), [])).toMatchObject({ kind: "shortfall", count: 1 });
  });

  it("a charge three days away; the minimum-balance note stays in the app", () => {
    const charge = { kind: "charge" as const, account, charge: "sms" as const, amount: 17.7, date: "2026-10-05", days: 3 };
    const minBal = { kind: "minBalance" as const, account, amount: 354, date: "2026-09-01" };
    expect(reminderFor(result([charge, minBal]), [])).toMatchObject({ kind: "charge", count: 1 });
    expect(reminderFor(result([minBal]), [])).toBeNull();
  });
});
