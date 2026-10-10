import { cleanName } from "./corrections";

// Savings goals and "what if" sums. Plain arithmetic the user can follow:
//   still to save = target - saved
//   months needed = still to save / saving each month (rounded up)
//   needed each month = still to save / months until the target month
// Nothing here is a forecast of markets or interest; it is the user's own
// numbers, written out.

export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** What the user plans to put aside each month. */
  monthly?: number;
  /** When they want it by: "YYYY-MM". */
  by?: string;
  currency: string;
};

export type GoalPlan = {
  remaining: number;
  done: boolean;
  /** With the monthly saving: how many months, and the month it is reached. */
  monthsNeeded?: number;
  reachedIn?: string;
  /** With a target month: how many months are left and what each must hold. */
  monthsLeft?: number;
  neededMonthly?: number;
  /** Both given: whether the monthly saving reaches the target month. */
  onTrack?: boolean;
};

/** What a user usually has left over in a month, per currency, and the months it is the average of. */
export type UsualLeftOver = { currency: string; amount: number; months: string[] };

export const MAX_GOALS = 20;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e12 ? round2(v) : null);

/** "2026-10" plus n months. */
export function addMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Whole months from one "YYYY-MM" to another (0 when the same month). */
export const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

export function planGoal(goal: Pick<Goal, "target" | "saved" | "monthly" | "by">, thisMonth: string, extraMonthly = 0): GoalPlan {
  const remaining = round2(Math.max(0, goal.target - goal.saved));
  if (remaining === 0) return { remaining, done: true };
  const plan: GoalPlan = { remaining, done: false };
  const monthly = (goal.monthly ?? 0) + extraMonthly;
  if (monthly > 0) {
    plan.monthsNeeded = Math.ceil(remaining / monthly - 1e-9);
    plan.reachedIn = addMonth(thisMonth, plan.monthsNeeded);
  }
  if (goal.by) {
    // Saving at the end of this month counts, so a goal for this month has one month left.
    plan.monthsLeft = Math.max(1, monthsBetween(thisMonth, goal.by) + 1);
    plan.neededMonthly = round2(remaining / plan.monthsLeft);
    if (monthly > 0) plan.onTrack = monthly + 0.005 >= plan.neededMonthly;
  }
  return plan;
}

/**
 * Reads one goal from what the browser sent (or from storage), or null when
 * anything is wrong. The id is checked by the caller.
 */
export function readGoal(value: unknown, thisMonth?: string): Omit<Goal, "id" | "currency"> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const name = cleanName(v.name);
  const target = money(v.target);
  const saved = v.saved === undefined || v.saved === null || v.saved === "" ? 0 : money(v.saved);
  const monthly = v.monthly === undefined || v.monthly === null || v.monthly === "" ? undefined : money(v.monthly);
  const by = v.by === undefined || v.by === null || v.by === "" ? undefined : typeof v.by === "string" && MONTH.test(v.by) ? v.by : null;
  if (!name || !target || target <= 0 || saved === null || monthly === null || by === null) return null;
  if (by && thisMonth && by < thisMonth) return null; // a target in the past
  return { name, target, saved, ...(monthly ? { monthly } : {}), ...(by ? { by } : {}) };
}

/** Stored goals, read defensively: malformed ones are dropped. */
export function readGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) return [];
  const out: Goal[] = [];
  for (const item of value.slice(0, MAX_GOALS)) {
    const goal = readGoal(item);
    const { id, currency } = (item ?? {}) as Record<string, unknown>;
    if (goal && typeof id === "string" && /^[\w-]{1,40}$/.test(id) && typeof currency === "string" && /^[A-Z]{3}$/.test(currency)) {
      out.push({ id, currency, ...goal });
    }
  }
  return out;
}
