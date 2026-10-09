import { ArrowLeftRight, Home, Landmark, PlugZap, ReceiptText } from "lucide-react";

// Main navigation. Icons are lucide components so they inherit the text colour
// and work in both light and dark mode.
export const sidebarLinks = [
  { icon: Home, route: "/", label: "Home" },
  { icon: Landmark, route: "/my-banks", label: "My Banks" },
  { icon: ReceiptText, route: "/transaction-history", label: "Transaction History" },
  { icon: ArrowLeftRight, route: "/payment-transfer", label: "Payment Transfer" },
  { icon: PlugZap, route: "/connect-bank", label: "Connect Bank" },
];

// Chart segment classes, in the order accounts and categories are drawn.
export const CHART_COLOR_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

// Labels for the three ways a bank can be linked.
export const PROVIDER_LABELS: Record<string, { name: string; region: string; mode: string }> = {
  plaid: { name: "Plaid", region: "US", mode: "Sandbox" },
  setu: { name: "Setu AA", region: "India", mode: "Sandbox" },
  manual: { name: "Statement", region: "India", mode: "Imported" },
};

// Which light/dark control the app shows: "knob" (portfolio slider with
// labels), "sky" (sun/moon day-night switch) or "pill" (lucide sun/moon in a
// sliding disc). Flip here to compare.
export const THEME_SWITCH_VARIANT: "knob" | "sky" | "pill" = "pill";
