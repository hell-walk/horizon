import { ArrowLeftRight, CalendarClock, Home, Landmark, PlugZap, ReceiptText, ShieldCheck, Target } from "lucide-react";

import type { Translate } from "@/lib/i18n/translate";

// Main navigation. Icons are lucide components so they inherit the text colour
// and work in both light and dark mode. `label` is the English name; the
// screens show t(labelKey), or t(shortKey) where space is tight. `phone: false`
// moves a link from the phone's bottom bar (room for four and "More") into More.
export const sidebarLinks = [
  { icon: Home, route: "/", label: "Home", labelKey: "nav.home", shortKey: "nav.home" },
  { icon: Landmark, route: "/my-banks", label: "My Banks", labelKey: "nav.myBanks", shortKey: "nav.myBanksShort" },
  { icon: ReceiptText, route: "/transaction-history", label: "Transaction History", labelKey: "nav.history", shortKey: "nav.historyShort" },
  { icon: CalendarClock, route: "/bills", label: "Bills", labelKey: "nav.bills", shortKey: "nav.billsShort" },
  { icon: PlugZap, route: "/connect-bank", label: "Connect Bank", labelKey: "nav.connect", shortKey: "nav.connectShort", phone: false },
];

// Behind "More" (the three dots) everywhere. Sending money is US-only (Dwolla);
// in India people pay with UPI, so it does not need a place in the main bar.
export const moreLinks = [
  { icon: Target, route: "/goals", label: "Savings goals", labelKey: "nav.goals", shortKey: "nav.goals" },
  { icon: ArrowLeftRight, route: "/payment-transfer", label: "Payment Transfer", labelKey: "nav.transfer", shortKey: "nav.transferShort" },
  { icon: ShieldCheck, route: "/my-data", label: "Privacy and your data", labelKey: "nav.myData", shortKey: "nav.myData" },
];

// Chart segment classes, in the order accounts and categories are drawn.
export const CHART_COLOR_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

/** Colour class for a chart segment: "Other" is always neutral, the rest cycle the palette. */
export const chartColorClass = (name: string, index: number) =>
  name === "Other" ? "bg-chart-other" : CHART_COLOR_CLASSES[index % CHART_COLOR_CLASSES.length];

// Labels for the three ways a bank can be linked. `name`, `region` and `mode`
// are the English words; show t(nameKey), t(regionKey) and t(modeKey) on screen.
export const PROVIDER_LABELS: Record<string, { name: string; region: string; mode: string; nameKey: string; regionKey: string; modeKey: string }> = {
  plaid: { name: "Plaid", region: "US", mode: "Sandbox", nameKey: "common.providerPlaid", regionKey: "common.regionUs", modeKey: "common.modeSandbox" },
  setu: { name: "Setu AA", region: "India", mode: "Sandbox", nameKey: "common.providerSetu", regionKey: "common.regionIndia", modeKey: "common.modeSandbox" },
  manual: { name: "Statement", region: "India", mode: "Imported", nameKey: "common.providerManual", regionKey: "common.regionIndia", modeKey: "common.modeImported" },
};

// The spending buckets from lib/spending (and "UPI payments" from lib/payees),
// keyed by their English name. The English name stays the data (colours and
// sorting depend on it); only the label on screen is translated.
/** The on-screen name of a spending bucket or payee group (see lib/i18n/labels). */
export { dataLabel as spendTypeLabel } from "@/lib/i18n/labels";

// Which light/dark control the app shows: "knob" (portfolio slider with
// labels), "sky" (sun/moon day-night switch) or "pill" (lucide sun/moon in a
// sliding disc). Flip here to compare.
export const THEME_SWITCH_VARIANT: "knob" | "sky" | "pill" = "pill";
