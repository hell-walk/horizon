import {
  ArrowLeftRight,
  BadgeIndianRupee,
  CalendarClock,
  CalendarDays,
  FileText,
  HandCoins,
  Info,
  Gem,
  Home,
  Landmark,
  MessageSquare,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  Repeat,
  Target,
} from "lucide-react";

import type { Translate } from "@/lib/i18n/translate";

// Main navigation. Icons are lucide components so they inherit the text colour
// and work in both light and dark mode. `label` is the English name; the
// screens show t(labelKey), or t(shortKey) where space is tight. `phone: false`
// moves a link from the phone's bottom bar (room for four and "More") into More;
// `wide: true` keeps it in the top bar only on wide screens (xl), in More below.
export const sidebarLinks = [
  { icon: Home, route: "/", label: "Home", labelKey: "nav.home", shortKey: "nav.home" },
  { icon: Landmark, route: "/my-banks", label: "My Banks", labelKey: "nav.myBanks", shortKey: "nav.myBanksShort" },
  { icon: ReceiptText, route: "/transaction-history", label: "Transaction History", labelKey: "nav.history", shortKey: "nav.historyShort" },
  { icon: CalendarClock, route: "/bills", label: "Bills", labelKey: "nav.bills", shortKey: "nav.billsShort" },
  { icon: HandCoins, route: "/loans", label: "EMIs and loans", labelKey: "nav.loans", shortKey: "nav.loansShort", phone: false, wide: true },
  { icon: BadgeIndianRupee, route: "/charges", label: "Bank charges", labelKey: "nav.charges", shortKey: "nav.chargesShort", phone: false, wide: true },
  { icon: PlugZap, route: "/connect-bank", label: "Connect Bank", labelKey: "nav.connect", shortKey: "nav.connectShort", phone: false },
];

// Behind "More" (the three dots) everywhere. Sending money is US-only (Dwolla);
// in India people pay with UPI, so it does not need a place in the main bar.
export const moreLinks = [
  { icon: Repeat, route: "/subscriptions", label: "Subscriptions and recharges", labelKey: "nav.subscriptions", shortKey: "nav.subscriptionsShort" },
  { icon: CalendarDays, route: "/calendar", label: "Cash-flow calendar", labelKey: "nav.calendar", shortKey: "nav.calendarShort" },
  { icon: FileText, route: "/report", label: "Monthly report", labelKey: "nav.report", shortKey: "nav.reportShort" },
  { icon: Target, route: "/goals", label: "Savings goals", labelKey: "nav.goals", shortKey: "nav.goals" },
  { icon: ArrowLeftRight, route: "/payment-transfer", label: "Payment Transfer", labelKey: "nav.transfer", shortKey: "nav.transferShort" },
  { icon: ShieldCheck, route: "/my-data", label: "Privacy and your data", labelKey: "nav.myData", shortKey: "nav.myData" },
  { icon: Gem, route: "/plans", label: "Plans", labelKey: "nav.plans", shortKey: "nav.plans" },
  { icon: MessageSquare, route: "/feedback", label: "Feedback", labelKey: "nav.feedback", shortKey: "nav.feedback" },
  { icon: Info, route: "/about-horizon", label: "About Horizon", labelKey: "nav.about", shortKey: "nav.aboutShort" },
];

// Chart segment classes, in the order accounts and categories are drawn.
export const CHART_COLOR_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6", "bg-chart-7", "bg-chart-8"];

/** Colour class for a chart segment: "Other" and "Miscellaneous" are always neutral, the rest cycle the palette. */
export const chartColorClass = (name: string, index: number) =>
  name === "Other" || name === "Miscellaneous" ? "bg-chart-other" : CHART_COLOR_CLASSES[index % CHART_COLOR_CLASSES.length];

// Labels for the three ways a bank can be linked. `name`, `region` and `mode`
// are the English words; show t(nameKey), t(regionKey) and t(modeKey) on screen.
export const PROVIDER_LABELS: Record<string, { name: string; region: string; mode: string; nameKey: string; regionKey: string; modeKey: string }> = {
  plaid: { name: "Plaid", region: "US", mode: "Sandbox", nameKey: "common.providerPlaid", regionKey: "common.regionUs", modeKey: "common.modeSandbox" },
  setu: { name: "Setu AA", region: "India", mode: "Sandbox", nameKey: "common.providerSetu", regionKey: "common.regionIndia", modeKey: "common.modeSandbox" },
  manual: {
    name: "Statement",
    region: "India",
    mode: "Imported",
    nameKey: "common.providerManual",
    regionKey: "common.regionIndia",
    modeKey: "common.modeImported",
  },
};

// The spending buckets from lib/finance/spending (and "UPI payments" from lib/finance/payees),
// keyed by their English name. The English name stays the data (colours and
// sorting depend on it); only the label on screen is translated.
/** The on-screen name of a spending bucket or payee group (see lib/i18n/labels). */
export { dataLabel as spendTypeLabel } from "@/lib/i18n/labels";

// Which light/dark control the app shows: "knob" (portfolio slider with
// labels), "sky" (sun/moon day-night switch) or "pill" (lucide sun/moon in a
// sliding disc). Flip here to compare.
export const THEME_SWITCH_VARIANT: "knob" | "sky" | "pill" = "pill";
