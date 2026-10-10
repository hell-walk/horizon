"use client";

import dynamic from "next/dynamic";

// Chart.js is only needed once a chart is on screen; keep it out of the initial
// bundle and skip server rendering since it draws on a canvas anyway.
const placeholder = () => <div className="size-full animate-pulse rounded-full bg-surface-container" />;

export const DoughnutChart = dynamic(() => import("./DoughnutChart"), { ssr: false, loading: placeholder });

export const RadialBarChart = dynamic(() => import("./RadialBarChart"), { ssr: false, loading: placeholder });

export default DoughnutChart;
