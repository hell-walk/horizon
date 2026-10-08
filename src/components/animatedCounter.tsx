"use client";

import CountUp from "react-countup";

import { formatAmount } from "@/lib/utils";

const AnimatedCounter = ({ amount, currency = "USD" }: { amount: number; currency?: string }) => {
  return (
    <div className="w-full">
      <CountUp
        duration={2.75}
        decimals={2}
        end={amount}
        formattingFn={(value) => formatAmount(value, currency)}
      />
    </div>
  );
};

export default AnimatedCounter;
