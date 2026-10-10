"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import { ENTRANCE, useChartColors } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip);

// Solid doughnut: one wedge per account, all in the same currency.
const DoughnutChart = ({ accounts }: DoughnutChartProps) => {
  const colors = useChartColors();

  const data = {
    labels: accounts.map((a) => a.name),
    datasets: [
      {
        data: accounts.map((a) => Math.max(a.currentBalance, 0)),
        backgroundColor: accounts.map((_, i) => colors.segments[i % colors.segments.length]),
        borderColor: colors.card,
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <Doughnut
      role="img"
      aria-label={`Balances by account: ${accounts.map((a) => `${a.name} ${formatAmount(a.currentBalance, a.currency)}`).join(", ")}`}
      data={data}
      options={{
        cutout: "68%",
        maintainAspectRatio: false,
        animation: ENTRANCE,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.text,
            titleColor: colors.card,
            bodyColor: colors.card,
            displayColors: false,
            callbacks: {
              label: (item) => formatAmount(item.parsed, accounts[item.dataIndex]?.currency),
            },
          },
        },
      }}
    />
  );
};

export default DoughnutChart;
