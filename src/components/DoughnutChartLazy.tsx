"use client";

import dynamic from "next/dynamic";

// Chart.js is only needed once the balance box is on screen; keep it out of the
// initial bundle and skip server rendering since it draws on a canvas anyway.
const DoughnutChart = dynamic(() => import("./DoughnutChart"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-full bg-gray-100" />,
});

export default DoughnutChart;
