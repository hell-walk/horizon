// Adding up balances held in different currencies, for "everything together".
// Rates are the European Central Bank's published daily reference rates: one
// unit of the base currency buys `rates[code]` of another, so an amount in that
// other currency is worth `amount / rates[code]` in the base.

export type Rates = { base: string; date: string; rates: Record<string, number> };

export type Combined = {
  base: string;
  total: number;
  parts: { currency: string; amount: number; inBase: number; rate?: number }[];
  /** Currencies with no published rate: left out of the total, and said so. */
  missing: string[];
  date?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function combineTotals(totals: Record<string, number>, base: string, rates: Rates | null): Combined {
  const parts: Combined["parts"] = [];
  const missing: string[] = [];
  for (const [currency, amount] of Object.entries(totals)) {
    if (currency === base) {
      parts.push({ currency, amount, inBase: round2(amount) });
      continue;
    }
    const rate = rates?.base === base ? rates.rates[currency] : undefined;
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      missing.push(currency);
      continue;
    }
    // Shown to the user the familiar way round: 1 USD = 96.71 INR.
    parts.push({ currency, amount, inBase: round2(amount / rate), rate: round2(1 / rate) });
  }
  return { base, total: round2(parts.reduce((s, p) => s + p.inBase, 0)), parts, missing, ...(rates?.date ? { date: rates.date } : {}) };
}
