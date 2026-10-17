import { ArrowUpRight, BadgeIndianRupee } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { bankCharges } from "@/lib/server/charges";
import { formatAmount } from "@/lib/utils";

/**
 * Home's line on bank charges: what the banks took in the last year the
 * statements cover, with a link to the page that breaks it down. Shows
 * nothing until a charge has been found.
 */
const ChargesTeaser = async ({ ownerId }: { ownerId: string }) => {
  const all = (await bankCharges(ownerId)).filter((a) => a.report.count > 0);
  if (all.length === 0) return null;

  const t = await getT();
  const totals = new Map<string, number>();
  for (const a of all) totals.set(a.account.currency, (totals.get(a.account.currency) ?? 0) + a.report.total);
  const amount = [...totals.entries()].map(([currency, n]) => formatAmount(n, currency)).join(" + ");
  const months = Math.max(...all.map((a) => a.report.months));

  return (
    <section className="panel" aria-labelledby="charges-home">
      <header className="panel-head">
        <h2 id="charges-home" className="eyebrow flex items-center gap-2">
          <BadgeIndianRupee className="size-3.5" aria-hidden /> {t("charges.homeTitle")}
        </h2>
        <Link href="/charges" className="btn-ghost btn-sm">
          {t("charges.homeAction")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <p className="px-4 py-3 text-14 text-ink">{t("charges.homeText", { count: months, amount })}</p>
    </section>
  );
};

export default ChargesTeaser;
