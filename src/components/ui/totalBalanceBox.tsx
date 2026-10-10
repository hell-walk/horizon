import { PROVIDER_LABELS } from "@/constants";
import { getT } from "@/lib/i18n/server";

import AnimatedCounter from "../animatedCounter";

// Currencies with a written-out name in the message files (home.currency_XXX).
const NAMED_CURRENCIES = new Set(["USD", "INR", "GBP", "EUR"]);

// One card per currency. Balances in different currencies are never added together.
// Server only: rendered by the Home and My Banks pages.
const TotalBalanceBox = async ({ accounts = [], totalsByCurrency, totalCurrentBalance, primaryCurrency = "USD" }: TotlaBalanceBoxProps) => {
  const t = await getT();
  const totals = Object.entries(totalsByCurrency ?? { [primaryCurrency]: totalCurrentBalance });

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {totals.map(([currency, total]) => {
        const group = accounts.filter((a) => (a.currency || "USD") === currency);
        const providers = Array.from(new Set(group.map((a) => t((PROVIDER_LABELS[a.provider] ?? PROVIDER_LABELS.plaid).nameKey))));
        const currencyName = NAMED_CURRENCIES.has(currency) ? t(`home.currency_${currency}`) : currency;

        return (
          <article key={currency} className="panel flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="eyebrow">{t("home.currencyBalance", { currency: currencyName })}</p>
                <p className="text-12 text-ink-muted">
                  {providers.length > 0
                    ? t("home.balanceAccountsVia", { count: group.length, providers: providers.join(", ") })
                    : t("home.balanceAccounts", { count: group.length })}
                </p>
              </div>
              <span translate="no" className="chip">
                {currency}
              </span>
            </div>

            <p translate="no" className="amount min-w-0 break-words text-32 font-semibold text-ink sm:text-40">
              <AnimatedCounter amount={total} currency={currency} />
            </p>
          </article>
        );
      })}

      {totals.length === 0 && (
        <article className="panel flex flex-col gap-2 p-5 md:col-span-2">
          <p className="eyebrow">{t("home.noAccountsTitle")}</p>
          <p className="text-14 text-ink-muted">{t("home.noAccountsBody")}</p>
        </article>
      )}
    </section>
  );
};

export default TotalBalanceBox;
