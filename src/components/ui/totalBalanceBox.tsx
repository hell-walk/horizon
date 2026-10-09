import { PROVIDER_LABELS } from "@/constants";

import AnimatedCounter from "../animatedCounter";

const CURRENCY_NAMES: Record<string, string> = { USD: "US dollar", INR: "Indian rupee", GBP: "Pound sterling", EUR: "Euro" };

// One card per currency. Balances in different currencies are never added together.
const TotalBalanceBox = ({ accounts = [], totalsByCurrency, totalCurrentBalance, primaryCurrency = "USD" }: TotlaBalanceBoxProps) => {
  const totals = Object.entries(totalsByCurrency ?? { [primaryCurrency]: totalCurrentBalance });

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {totals.map(([currency, total]) => {
        const group = accounts.filter((a) => (a.currency || "USD") === currency);
        const providers = Array.from(new Set(group.map((a) => PROVIDER_LABELS[a.provider]?.name ?? "Plaid")));

        return (
          <article key={currency} className="panel flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="eyebrow">{CURRENCY_NAMES[currency] ?? currency} balance</p>
                <p className="text-12 text-ink-muted">
                  {group.length} {group.length === 1 ? "account" : "accounts"}
                  {providers.length > 0 && ` via ${providers.join(", ")}`}
                </p>
              </div>
              <span className="chip">{currency}</span>
            </div>

            <p className="amount min-w-0 break-words text-32 font-semibold text-ink sm:text-40">
              <AnimatedCounter amount={total} currency={currency} />
            </p>
          </article>
        );
      })}

      {totals.length === 0 && (
        <article className="panel flex flex-col gap-2 p-5 md:col-span-2">
          <p className="eyebrow">No accounts yet</p>
          <p className="text-14 text-ink-muted">Connect a bank or import a statement to see balances here.</p>
        </article>
      )}
    </section>
  );
};

export default TotalBalanceBox;
