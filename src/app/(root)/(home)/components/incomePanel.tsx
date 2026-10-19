import { CircleAlert, Wallet } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { incomeForOwner, loadIncome } from "@/lib/server/income";
import { formatAmount } from "@/lib/utils";

import IncomeChooser from "./incomeChooser";

/**
 * Home's "Money in": what arrives each month, read the way the person said
 * they earn. When Horizon does not know how they earn yet (older profiles),
 * the panel asks, once.
 */
const IncomePanel = async ({ ownerId, currency }: { ownerId: string; currency: string }) => {
  const t = await getT();
  const setting = await loadIncome(ownerId).catch(() => null);
  const estimate = setting ? await incomeForOwner(ownerId, setting).catch(() => null) : null;
  const money = (n: number) => formatAmount(n, currency);

  let line: string | null = null;
  let note: string | null = null;
  if (estimate) {
    if (estimate.source === "salary" && estimate.salary && estimate.side) {
      line = t("home.incomeSalaryPlus", {
        amount: money(estimate.monthly ?? 0),
        payee: estimate.salary.payee,
        salary: money(estimate.salary.monthly),
        side: money(estimate.side),
      });
    } else if (estimate.source === "salary" && estimate.salary) {
      line = t("home.incomeSalary", { amount: money(estimate.salary.monthly), payee: estimate.salary.payee, count: estimate.salary.months });
    } else if (estimate.source === "declared" && estimate.declared) {
      line = t("home.incomeDeclared", { amount: money(estimate.declared), seen: money(estimate.creditsMonthly) });
      if (estimate.mismatch) note = t("home.incomeMismatch");
    } else if (estimate.source === "credits") {
      line = t("home.incomeCredits", { amount: money(estimate.creditsMonthly), count: estimate.months });
      if (estimate.kind === "salaried") note = t("home.incomeNoSalary");
    } else {
      line = t("home.incomeNone");
    }
  }

  return (
    <section className="panel" aria-labelledby="income-title">
      <header className="panel-head">
        <h2 id="income-title" className="eyebrow flex items-center gap-2">
          <Wallet className="size-3.5" aria-hidden /> {t("home.incomeTitle")}
        </h2>
        {setting && <span className="eyebrow">{t("home.incomeYouSaid", { kind: t(`common.incomeKind_${setting.kind}`) })}</span>}
      </header>
      <div className="panel-body flex flex-col gap-3">
        {setting ? (
          <>
            {line && <p className="text-14 text-ink">{line}</p>}
            {note && (
              <p className="flex items-start gap-2 text-13 text-warn-ink">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{note}</span>
              </p>
            )}
            {estimate?.source === "none" && (
              <Link href="/upload-statement" className="btn-secondary w-fit">
                {t("home.actionUpload")}
              </Link>
            )}
          </>
        ) : (
          <p className="text-14 text-ink-muted">{t("home.incomeAsk")}</p>
        )}
        <IncomeChooser current={setting?.kind ?? null} declared={setting?.declared} side={setting?.side} />
      </div>
    </section>
  );
};

export default IncomePanel;
