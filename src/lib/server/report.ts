import "server-only";

import { cache } from "react";

import { applyCorrections } from "../corrections";
import { getStatementTransactions, MANUAL_PROVIDER, toManualAccount } from "../providers/manual";
import { findRegular } from "../recurring";
import { monthlyReport, reportMonths, type Report } from "../report";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";

export type MonthlyReport = { report: Report | null; months: string[]; currency: string };

/** The report for one person: the month asked for, or the latest full month. Once per request per month. */
export const reportForOwner = cache(async (ownerId: string, month?: string): Promise<MonthlyReport> => {
  const [banks, corrections] = await Promise.all([getBanks({ userId: ownerId }), loadCorrections(ownerId)]);
  const today = new Date();
  const accounts = await Promise.all(
    banks
      .filter((bank) => bank.provider === MANUAL_PROVIDER)
      .map(async (bank) => {
        const account = toManualAccount(bank);
        const transactions = applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[];
        return { currency: account.currency, transactions, regular: findRegular(transactions, today) };
      }),
  );
  const transactions = accounts.flatMap((a) => a.transactions);
  const months = reportMonths(transactions);
  const chosen = month && /^\d{4}-\d{2}$/.test(month) && months.includes(month) ? month : months[0];
  return {
    report: chosen
      ? monthlyReport(
          transactions,
          accounts.flatMap((a) => a.regular),
          chosen,
        )
      : null,
    months,
    currency: accounts[0]?.currency ?? "INR",
  };
});
