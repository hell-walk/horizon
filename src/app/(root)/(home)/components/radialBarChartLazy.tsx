"use client";

import dynamic from "next/dynamic";

import { BarsLoader } from "../../../../components/ui/loaders";

// The concentric-arcs chart (Home's spending chart, the spending deep-dive).
// Chart.js loads only once a chart is on screen; it draws on a canvas, so no
// server rendering.
const RadialBarChart = dynamic(() => import("./radialBarChart"), { ssr: false, loading: () => <BarsLoader className="size-full" /> });

export default RadialBarChart;
