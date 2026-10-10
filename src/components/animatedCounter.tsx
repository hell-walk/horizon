"use client";

import CountUp from "react-countup";

import { prefersReducedMotion } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";

const AnimatedCounter = ({ amount, currency = "USD" }: { amount: number; currency?: string }) => {
  return (
    <span className="inline-block w-full">
      <CountUp
        duration={prefersReducedMotion() ? 0 : 2.75}
        decimals={2}
        end={amount}
        formattingFn={(value) => formatAmount(value, currency)}
      />
    </span>
  );
};

export default AnimatedCounter;
