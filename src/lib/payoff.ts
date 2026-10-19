// Paying off a loan: how long it takes and what the interest comes to, from
// the outstanding amount, the yearly rate and the EMI, and the same again
// with extra money thrown at it. Month by month, the way a bank's reducing-
// balance loan works: interest on what is left, the payment covers the
// interest first, the rest brings the balance down. Fixed-rate arithmetic;
// a floating rate moves, so the result is an estimate at today's rate.

export type PayoffInput = {
  outstanding: number;
  /** Per year, in percent: 10.5 for 10.5%. */
  annualRate: number;
  /** The EMI being paid now. */
  emi: number;
  /** Paid on top of the EMI every month. */
  extraMonthly?: number;
  /** Paid once, now. */
  lumpSum?: number;
};

export type Payoff = { months: number; interest: number; totalPaid: number; payoffDate: string };

/** What the person told Horizon about a loan (the statements show only the EMI); saved with the loan. */
export type LoanPlan = { outstanding: number; annualRate: number; extraMonthly?: number; lumpSum?: number };

const MAX_MONTHS = 600;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The month `n` months from today, as YYYY-MM-DD on the same day of the month (or the last day). */
export function monthsFrom(today: Date, n: number): string {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(today.getUTCDate(), last);
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/**
 * How the loan runs down. Null when the monthly payment does not even cover
 * the interest (it would never end) or the figures make no sense.
 */
export function payoff(input: PayoffInput, today = new Date()): Payoff | null {
  const i = input.annualRate / 1200;
  const payment = input.emi + (input.extraMonthly ?? 0);
  let balance = input.outstanding - (input.lumpSum ?? 0);
  if (!Number.isFinite(i) || i < 0 || !Number.isFinite(payment) || payment <= 0 || !Number.isFinite(balance)) return null;
  if (balance <= 0) return { months: 0, interest: 0, totalPaid: round2(input.lumpSum ?? 0), payoffDate: monthsFrom(today, 0) };
  if (balance * i >= payment) return null;

  let months = 0;
  let interest = 0;
  let paid = input.lumpSum ?? 0;
  while (balance > 0.005 && months < MAX_MONTHS) {
    const due = balance * i;
    interest += due;
    balance += due;
    const pay = Math.min(payment, balance);
    balance -= pay;
    paid += pay;
    months++;
  }
  if (balance > 0.005) return null;
  return { months, interest: round2(interest), totalPaid: round2(paid), payoffDate: monthsFrom(today, months) };
}

export type PayoffPlan = { baseline: Payoff; faster: Payoff; interestSaved: number; monthsSaved: number };

/** The loan as it is, against the loan with the extra money, and what the extra saves. */
export function comparePayoff(input: PayoffInput, today = new Date()): PayoffPlan | null {
  const baseline = payoff({ outstanding: input.outstanding, annualRate: input.annualRate, emi: input.emi }, today);
  const faster = payoff(input, today);
  if (!baseline || !faster) return null;
  return { baseline, faster, interestSaved: round2(baseline.interest - faster.interest), monthsSaved: baseline.months - faster.months };
}
