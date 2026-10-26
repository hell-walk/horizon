import { formatAmount } from "@/lib/utils";

// The balance, rendered on the server so it is there with the page. It used to
// count up from zero in the browser, which left the box empty until the page's
// script had run: on a slow phone, seconds of a blank panel.
const AnimatedCounter = ({ amount, currency = "USD" }: { amount: number; currency?: string }) => (
  <span translate="no" className="amount-arrive inline-block w-full">
    {formatAmount(amount, currency)}
  </span>
);

export default AnimatedCounter;
