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

/**
 * What the person told Horizon about a loan, saved with it. The statements show
 * the EMI and nothing else: when it was taken and for how many months say when
 * it ends; the outstanding amount and the rate say what it still costs.
 */
export type LoanPlan = {
  outstanding?: number;
  annualRate?: number;
  extraMonthly?: number;
  lumpSum?: number;
  /** The EMI as the person knows it, when the statements' figure is off. */
  emi?: number;
  /** YYYY-MM-DD */
  borrowed?: string;
  /** Months, in all. */
  tenure?: number;
};

export type Schedule = { firstDue: string; paid: number; remaining: number; endDate: string };

/**
 * The EMI calendar of a loan from when it was taken and for how long. The first
 * EMI falls in the month after borrowing, on the lender's usual day (or the
 * same day of the month as the loan); borrowing after the lender's cut-off day
 * pushes it one more month, as Snapmint does after the 26th.
 */
export function scheduleFrom({
  borrowed,
  tenure,
  dueDay,
  cutoffDay,
  today = new Date(),
}: {
  borrowed: string;
  tenure: number;
  dueDay?: number;
  cutoffDay?: number;
  today?: Date;
}): Schedule | null {
  const start = new Date(`${borrowed}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || !Number.isInteger(tenure) || tenure < 1) return null;
  const day = dueDay ?? start.getUTCDate();
  const skip = cutoffDay !== undefined && start.getUTCDate() > cutoffDay ? 2 : 1;
  const due = (n: number) => {
    // The n-th EMI (1-based): `skip` months after borrowing, then monthly, on `day` or the month's last day.
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + skip + (n - 1);
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
  };
  const todayIso = today.toISOString().slice(0, 10);
  let paid = 0;
  while (paid < tenure && due(paid + 1) <= todayIso) paid++;
  return { firstDue: due(1), paid, remaining: tenure - paid, endDate: due(tenure) };
}

/** What is still owed when `remaining` EMIs are left at this rate: the present value of those payments. */
export function outstandingFromSchedule({ emi, annualRate, remaining }: { emi: number; annualRate: number; remaining: number }): number {
  const i = annualRate / 1200;
  if (remaining <= 0 || emi <= 0) return 0;
  if (i === 0) return round2(emi * remaining);
  return round2((emi * (1 - Math.pow(1 + i, -remaining))) / i);
}

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
