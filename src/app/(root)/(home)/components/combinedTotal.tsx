import { combineTotals } from "@/lib/currency";
import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import { exchangeRates } from "@/lib/server/rates";
import { formatAmount } from "@/lib/utils";

/**
 * "All together": balances in different currencies added up in one, at the
 * European Central Bank's published rate, with the rate and its date shown.
 * Only for people with more than one currency; nothing if rates cannot be had.
 */
const CombinedTotal = async ({ totals, base }: { totals: Record<string, number>; base: string }) => {
  const currencies = Object.keys(totals);
  if (currencies.length < 2) return null;
  const rates = await exchangeRates(base, currencies);
  if (!rates) return null;
  const combined = combineTotals(totals, base, rates);
  if (combined.parts.length < 2) return null;

  const t = await getT();
  const locale = await getLocale();
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="panel panel-body flex flex-col gap-1 text-14" aria-labelledby="combined-total">
      <p id="combined-total" className="eyebrow">
        {t("home.combinedTitle", { currency: base })}
      </p>
      <p translate="no" className="amount text-24 font-semibold text-ink">
        {t("home.combinedAbout")} {formatAmount(combined.total, base)}
      </p>
      <ul className="flex flex-col gap-0.5 text-13 text-ink-muted">
        {combined.parts
          .filter((p) => p.currency !== base)
          .map((p) => (
            <li key={p.currency} translate="no">
              {formatAmount(p.amount, p.currency)} ≈ {formatAmount(p.inBase, base)} (
              {t("home.combinedRate", { currency: p.currency, rate: formatAmount(p.rate!, base) })})
            </li>
          ))}
      </ul>
      {combined.missing.length > 0 && <p className="text-13 text-warn-ink">{t("home.combinedMissing", { currencies: combined.missing.join(", ") })}</p>}
      <p className="text-12 text-ink-muted">{t("home.combinedSource", { date: combined.date ? day(combined.date) : "" })}</p>
    </section>
  );
};

export default CombinedTotal;
