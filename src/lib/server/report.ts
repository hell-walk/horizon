import "server-only";

import { cache } from "react";

import { monthlyReport, reportMonths, type Report } from "../finance/report";
import { ownerAccounts } from "./ownerAccounts";

export type MonthlyReport = { report: Report | null; months: string[]; currency: string };

/** The report for one person: the month asked for, or the latest full month. Once per request per month. */
export const reportForOwner = cache(async (ownerId: string, month?: string): Promise<MonthlyReport> => {
  const accounts = (await ownerAccounts(ownerId)).map(({ account, transactions, regular }) => ({ currency: account.currency, transactions, regular }));
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
