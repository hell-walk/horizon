import "server-only";

import { forecast, type Forecast } from "../forecast";
import { findRegular } from "../recurring";
import { getAccount } from "./accounts";

export type AccountForecast = {
  account: { id: string; name: string; mask: string; currency: string };
  forecast: Forecast | { ok: false; reason: "noBalance" };
};

/**
 * The forecast for one of the signed-in user's accounts (getAccount only
 * returns the user's own). Imported statements are projected from the day
 * they end; linked banks from today.
 */
export async function accountForecast(appwriteItemId: string, today = new Date()): Promise<AccountForecast | null> {
  const loaded = await getAccount({ appwriteItemId });
  if (!loaded) return null;
  const data = loaded.data as Account;
  const transactions = (loaded.transactions as Transaction[]) ?? [];
  const account = { id: appwriteItemId, name: data.name, mask: data.mask, currency: data.currency ?? "INR" };

  if (data.balanceUnknown) return { account, forecast: { ok: false, reason: "noBalance" } };

  const lastDate = transactions.reduce((max, t) => (String(t.date).slice(0, 10) > max ? String(t.date).slice(0, 10) : max), "");
  return {
    account,
    forecast: forecast({
      balance: Number(data.currentBalance) || 0,
      balanceDate: data.provider === "manual" && lastDate ? lastDate : undefined,
      transactions,
      regulars: findRegular(transactions, today),
      today,
    }),
  };
}
