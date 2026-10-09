"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import { ENTRANCE, segmentColor, useChartColors } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip);

export type RadialBarItem = { name: string; amount: number; share: number };

// Concentric arcs: one ring per item, filled to that item's share of the total.
// Chart.js stacks datasets as rings, so each dataset is [value, remainder].
const RadialBarChart = ({ items, currency, unfold = false }: { items: RadialBarItem[]; currency?: string; unfold?: boolean }) => {
  const colors = useChartColors();

  const data = {
    labels: ["value", "rest"],
    datasets: items.map((item, i) => ({
      label: item.name,
      // Unfolding sweeps every arc closed into a full ring.
      data: unfold ? [1, 0] : [item.share, Math.max(1 - item.share, 0)],
      backgroundColor: [segmentColor(colors, item.name, i), colors.track],
      borderColor: colors.card,
      borderWidth: 2,
      borderRadius: [{ outerStart: 4, outerEnd: 4, innerStart: 4, innerEnd: 4 }, 0],
      hoverBackgroundColor: [segmentColor(colors, item.name, i), colors.track],
    })),
  };

  return (
    <Doughnut
      data={data}
      options={{
        cutout: "48%",
        rotation: -90,
        maintainAspectRatio: false,
        animation: unfold ? { duration: 480, easing: "easeOutCubic" } : ENTRANCE,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.text,
            titleColor: colors.card,
            bodyColor: colors.card,
            displayColors: false,
            filter: (item) => item.dataIndex === 0,
            callbacks: {
              title: (ctx) => ctx[0]?.dataset.label ?? "",
              label: (item) => {
                const entry = items[item.datasetIndex];
                return `${formatAmount(entry.amount, currency)} (${Math.round(entry.share * 100)}%)`;
              },
            },
          },
        },
      }}
    />
  );
};

export default RadialBarChart;
