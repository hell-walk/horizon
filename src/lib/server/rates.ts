import "server-only";

import { cached } from "../cache";
import type { Rates } from "../currency";
import { logError } from "./log";

// Exchange rates: the European Central Bank's daily reference rates, through
// Frankfurter (free, no key). The request carries only currency codes, never
// anything about the user. Kept for 12 hours; if the service cannot be reached
// the screen simply does not show a combined total.

const SOURCE = "https://api.frankfurter.dev/v1/latest";
const KEEP = 12 * 60 * 60 * 1000;
const CODE = /^[A-Z]{3}$/;

export async function exchangeRates(base: string, symbols: string[]): Promise<Rates | null> {
  if (!CODE.test(base)) return null;
  const want = [...new Set(symbols.filter((s) => CODE.test(s) && s !== base))].sort();
  if (want.length === 0) return { base, date: "", rates: {} };

  try {
    return await cached(`rates:${base}:${want.join(",")}`, KEEP, async () => {
      const res = await fetch(`${SOURCE}?base=${base}&symbols=${want.join(",")}`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (!res.ok) throw new Error(`rates: ${res.status}`);
      const body = (await res.json()) as { base?: unknown; date?: unknown; rates?: Record<string, unknown> };
      if (body.base !== base || typeof body.date !== "string" || !body.rates || typeof body.rates !== "object") throw new Error("rates: unexpected answer");
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(body.rates)) {
        if (CODE.test(code) && typeof value === "number" && Number.isFinite(value) && value > 0) rates[code] = value;
      }
      return { base, date: body.date.slice(0, 10), rates };
    });
  } catch (error) {
    logError("rates: could not fetch", error);
    return null;
  }
}
