"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { useRouter } from "next/navigation";
import { Doughnut } from "react-chartjs-2";

import ChartCentre from "@/components/chartCentre";
import { useT } from "@/components/i18nProvider";
import { spendTypeLabel } from "@/constants";
import { ENTRANCE, segmentColor, useChartColors } from "@/lib/chartColors";
import { MISC, type DetailSlice } from "@/lib/spendingDetail";
import { formatAmount } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip);

/**
 * Who the money went to, as a pie: one slice per payee (the lender, on the
 * EMI page), "Other" in grey. The same colours as the list beside it.
 */
const PayeePie = ({ payees, currency, total, accountId }: { payees: DetailSlice[]; currency: string; total: number; accountId: string }) => {
  const t = useT();
  const colors = useChartColors();
  const router = useRouter();

  return (
    <div className="relative mx-auto size-[200px]">
      <Doughnut
        role="img"
        aria-label={payees.map((p) => `${spendTypeLabel(t, p.name)} ${formatAmount(p.amount, currency)}, ${Math.round(p.share * 100)}%`).join("; ")}
        data={{
          labels: payees.map((p) => spendTypeLabel(t, p.name)),
          datasets: [
            {
              data: payees.map((p) => p.amount),
              backgroundColor: payees.map((p, i) => segmentColor(colors, p.name, i)),
              borderColor: colors.card,
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        }}
        options={{
          cutout: "58%",
          maintainAspectRatio: false,
          animation: ENTRANCE,
          // A slice opens that payee's payments in the account's history ("Miscellaneous" has no one behind it).
          onClick: (_event, elements) => {
            const p = elements[0] ? payees[elements[0].index] : undefined;
            if (p && p.name !== MISC) router.push(`/transaction-history?id=${accountId}&q=${encodeURIComponent(p.name)}`);
          },
          onHover: (event, elements) => {
            const target = event.native?.target as HTMLElement | null;
            if (target) target.style.cursor = elements[0] && payees[elements[0].index]?.name !== MISC ? "pointer" : "default";
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: colors.text,
              titleColor: colors.card,
              bodyColor: colors.card,
              displayColors: false,
              callbacks: {
                label: (item) => {
                  const p = payees[item.dataIndex];
                  return `${formatAmount(p.amount, currency)} · ${Math.round(p.share * 100)}%`;
                },
              },
            },
          },
        }}
      />
      <ChartCentre className="pointer-events-none absolute inset-0 flex-center flex-col px-10 text-center">
        <span className="eyebrow">{t("spending.tileTotal")}</span>
        <span translate="no" className="amount text-16 font-semibold text-ink">
          {formatAmount(total, currency)}
        </span>
      </ChartCentre>
    </div>
  );
};

export default PayeePie;
