"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatAmount } from "@/lib/utils";

import { RadialBarChart } from "./DoughnutChartLazy";
import type { RadialBarItem } from "./RadialBarChart";

const UNFOLD_MS = 560;

/**
 * The Home category chart as a doorway: clicking it sweeps every arc closed
 * into a full ring while the chart spins outward and fades, then opens the
 * full breakdown on Transaction History, where the payee chart spins in.
 */
const CategoryChartLink = ({ items, currency, total, href }: { items: RadialBarItem[]; currency?: string; total: number; href: string }) => {
  const router = useRouter();
  const [unfolding, setUnfolding] = useState(false);

  // Warm the destination so the hand-off is instant when the animation ends.
  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  const open = () => {
    if (unfolding) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    setUnfolding(true);
    window.setTimeout(() => router.push(href), UNFOLD_MS);
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open the full spending breakdown"
      className="group relative mx-auto block size-[180px] cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-4 focus-visible:ring-offset-card md:size-[200px]"
    >
      <span className={`absolute inset-0 block ${unfolding ? "chart-unfold" : "transition-transform duration-300 group-hover:scale-[1.04]"}`}>
        <RadialBarChart items={items} currency={currency} unfold={unfolding} />
      </span>
      <span className={`pointer-events-none absolute inset-0 flex-center flex-col px-8 text-center transition-opacity duration-200 ${unfolding ? "opacity-0" : ""}`}>
        <span className="eyebrow">Spent</span>
        <span className="amount text-16 font-semibold text-ink">{formatAmount(total, currency)}</span>
        <span className="eyebrow mt-1 text-ink-faint transition-colors group-hover:text-ink">Tap to open</span>
      </span>
    </button>
  );
};

export default CategoryChartLink;
