"use client";

import dynamic from "next/dynamic";

import { BarsLoader } from "@/components/loaders";

// Chart.js is only needed once a chart is on screen; keep it out of the initial
// bundle and skip server rendering since it draws on a canvas anyway.
const placeholder = () => <BarsLoader className="size-full" />;

export const DoughnutChart = dynamic(() => import("./DoughnutChart"), { ssr: false, loading: placeholder });

export const RadialBarChart = dynamic(() => import("./RadialBarChart"), { ssr: false, loading: placeholder });

export default DoughnutChart;
