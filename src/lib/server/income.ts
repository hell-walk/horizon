import "server-only";

import { cache } from "react";

import type { ForecastView } from "../finance/forecast";
import { estimateIncome, findSalary, incomingPayers, isIncomeKind, salaryCandidates, type IncomeEstimate, type IncomeKind, type SalaryCredit } from "../finance/income";
import { ownerAccounts } from "./ownerAccounts";
import { readPrefs } from "./prefs";

export type IncomeSetting = { kind: IncomeKind; declared?: number; salaryPayee?: string; excluded?: string[]; side?: number; payDay?: number };

/** How the person said they earn, from their settings; null when never asked (older profiles). */
export const loadIncome = cache(async (ownerId: string): Promise<IncomeSetting | null> => {
  const income = (await readPrefs(ownerId)).income;
  if (!income || typeof income !== "object" || !isIncomeKind(income.kind)) return null;
  const declared = typeof income.declared === "number" && Number.isFinite(income.declared) && income.declared > 0 ? income.declared : undefined;
  const salaryPayee = typeof income.salaryPayee === "string" && income.salaryPayee.length <= 80 ? income.salaryPayee : undefined;
  const excluded = Array.isArray(income.excluded) ? income.excluded.filter((p): p is string => typeof p === "string" && p.length <= 80).slice(-20) : undefined;
  const side = typeof income.side === "number" && Number.isFinite(income.side) && income.side > 0 ? income.side : undefined;
  const payDay = typeof income.payDay === "number" && Number.isInteger(income.payDay) && income.payDay >= 1 && income.payDay <= 31 ? income.payDay : undefined;
  return { kind: income.kind, declared, salaryPayee, excluded, side, payDay };
});

/**
 * The employer the statements show, if any: a company paying much the same
 * each month (lib/finance/income). "Salaried" is only accepted once there is one, so
 * Horizon knows which credit is the salary.
 */
export async function findEmployer(ownerId: string, setting?: IncomeSetting | null, ownNames?: string[]): Promise<SalaryCredit | undefined> {
  const transactions = (await ownerAccounts(ownerId)).flatMap((a) => a.transactions);
  return findSalary(transactions, { prefer: setting?.salaryPayee, exclude: setting?.excluded, ownNames });
}

export type SalaryOption = { payee: string; monthly: number; months: number; confidence: "high" | "medium"; payDay?: number };
export type IncomingPayer = { payee: string; total: number; months: number };

/**
 * What the income chooser offers someone who says they are salaried: the
 * likely salary credits, best first (Horizon asks about each in turn), and
 * everyone who sent money in, to pick from when none of those is it.
 */
export async function salaryOptions(ownerId: string, ownNames?: string[]): Promise<{ candidates: SalaryOption[]; payers: IncomingPayer[] }> {
  const [accounts, setting] = await Promise.all([ownerAccounts(ownerId), loadIncome(ownerId)]);
  const transactions = accounts.flatMap((a) => a.transactions);
  const candidates = salaryCandidates(transactions, { exclude: setting?.excluded, ownNames })
    .filter((c) => c.confidence !== "low")
    .slice(0, 3)
    .map((c) => ({ payee: c.payee, monthly: c.monthly, months: c.months, confidence: c.confidence as "high" | "medium", payDay: dayOfMonth(c.last) }));
  const payers = incomingPayers(transactions).map(({ payee, total, months }) => ({ payee, total, months }));
  return { candidates, payers };
}

/** Whether this payer sent the person money in their statements (the server's check on a picked salary credit). */
export async function sentMoneyIn(ownerId: string, payee: string): Promise<SalaryCredit | undefined> {
  const transactions = (await ownerAccounts(ownerId)).flatMap((a) => a.transactions);
  const found = incomingPayers(transactions, 500).some((p) => p.payee.toLowerCase() === payee.toLowerCase());
  return found ? findSalary(transactions, { prefer: payee }) : undefined;
}

/**
 * How the person's forecast is drawn. Salaried: pay day to pay day, on the
 * day they gave (or the day their employer's last credit arrived). Freelancer:
 * the calendar month. Everyone else: the next weeks.
 */
export async function forecastView(ownerId: string): Promise<{ view: ForecastView; payDay?: number }> {
  const setting = await loadIncome(ownerId).catch(() => null);
  if (setting?.kind === "freelancer") return { view: "month" };
  if (setting?.kind !== "salaried") return { view: "rolling" };
  const payDay = setting.payDay ?? dayOfMonth((await findEmployer(ownerId, setting).catch(() => undefined))?.last);
  return payDay ? { view: "payday", payDay } : { view: "month" };
}

/** The day of the month in an ISO date, when there is one. */
export const dayOfMonth = (date?: string) => {
  const day = Number(date?.slice(8, 10));
  return day >= 1 && day <= 31 ? day : undefined;
};

/** Money in each month across every uploaded account, read the way the person earns. */
export async function incomeForOwner(ownerId: string, setting: IncomeSetting): Promise<IncomeEstimate> {
  const transactions = (await ownerAccounts(ownerId)).flatMap((a) => a.transactions);
  return estimateIncome(transactions, setting.kind, setting.declared, { prefer: setting.salaryPayee, exclude: setting.excluded }, setting.side);
}
