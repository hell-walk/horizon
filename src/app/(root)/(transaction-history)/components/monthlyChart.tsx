"use client";

import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";

import { useT } from "@/components/i18nProvider";
import { ENTRANCE, useChartColors } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export type MonthBar = { month: string; label: string; moneyIn: number; moneyOut: number };

/** The page's success and danger colours, read from the theme's tokens ("r g b"). */
const useTones = () => {
  const { resolvedTheme } = useTheme();
  return useMemo(() => {
    if (typeof window === "undefined") return { success: "rgb(34 197 94)", danger: "rgb(239 68 68)" };
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => {
      const v = style.getPropertyValue(name).trim();
      return v ? `rgb(${v})` : fallback;
    };
    return { success: read("--success", "rgb(34 197 94)"), danger: read("--danger", "rgb(239 68 68)") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);
};

/** Money in and money out, month by month, as paired bars: oldest on the left. */
const MonthlyChart = ({ months, currency }: { months: MonthBar[]; currency?: string }) => {
  const t = useT();
  const colors = useChartColors();
  const tones = useTones();
  const ordered = [...months].reverse();

  return (
    <div className="h-64 px-2 pb-2 pt-4">
      <Bar
        role="img"
        aria-label={ordered
          .map(
            (m) => `${m.label}: ${t("history.monthIn")} ${formatAmount(m.moneyIn, currency)}, ${t("history.monthOut")} ${formatAmount(m.moneyOut, currency)}`,
          )
          .join("; ")}
        data={{
          labels: ordered.map((m) => m.label),
          datasets: [
            { label: t("history.monthIn"), data: ordered.map((m) => m.moneyIn), backgroundColor: tones.success, borderRadius: 4, maxBarThickness: 28 },
            { label: t("history.monthOut"), data: ordered.map((m) => m.moneyOut), backgroundColor: tones.danger, borderRadius: 4, maxBarThickness: 28 },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          animation: ENTRANCE,
          scales: {
            x: { grid: { display: false }, ticks: { color: colors.mutedText, font: { size: 11 } } },
            y: {
              beginAtZero: true,
              grid: { color: colors.track },
              ticks: { color: colors.mutedText, font: { size: 11 }, callback: (v) => formatAmount(Number(v), currency).replace(/\.00$/, "") },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: colors.text,
              titleColor: colors.card,
              bodyColor: colors.card,
              displayColors: true,
              callbacks: { label: (item) => `${item.dataset.label}: ${formatAmount(Number(item.raw), currency)}` },
            },
          },
        }}
      />
    </div>
  );
};

export default MonthlyChart;
