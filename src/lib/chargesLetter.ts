import type { ChargeKind, ChargeReport } from "./charges";
import { formatAmount } from "./utils";

// The request to reverse charges that the Bank charges page offers to copy.
// Always in English: it goes to the bank's complaint desk, which works in
// English, whatever language the person reads Horizon in.

const KIND_NAMES: Record<ChargeKind, string> = {
  bounce: "charge for a failed payment",
  minBalance: "minimum balance charge",
  sms: "SMS alert charge",
  card: "debit card fee",
  atm: "ATM charge",
  late: "late fee or penal interest",
  forex: "foreign currency markup",
  transfer: "NEFT/IMPS/RTGS charge",
  chequeBook: "cheque book charge",
  cash: "cash deposit charge",
  statement: "statement charge",
  gst: "GST on charges",
  other: "bank charge",
};

const LINES_SHOWN = 40;

const day = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** The letter for one account, listing its charges newest first. */
export function reversalRequest({
  bank,
  mask,
  currency,
  report,
  holder,
}: {
  bank: string;
  mask: string;
  currency: string;
  report: ChargeReport;
  holder: string;
}): string {
  const money = (n: number) => formatAmount(n, currency);
  const ending = mask ? ` ending ${mask.slice(-4)}` : "";
  // A kind the bank has already given back in full is not asked for again.
  const open = report.groups.filter((g) => g.count > 0 && g.refunded < g.amount);
  const total = open.reduce((s, g) => s + g.amount, 0);
  const reversed = open.reduce((s, g) => s + g.refunded, 0);
  const entries = open.flatMap((g) => g.entries.map((e) => ({ ...e, kind: g.kind }))).sort((a, b) => b.date.localeCompare(a.date));
  const shown = entries.slice(0, LINES_SHOWN);
  const lines = shown.map((e) => `- ${day(e.date)}: ${e.name} (${KIND_NAMES[e.kind]}), ${money(e.amount)}`);
  if (entries.length > shown.length) lines.push(`- and ${entries.length - shown.length} more, listed in my statements`);

  const minBalance = open.some((g) => g.kind === "minBalance");
  return [
    `Subject: Request to reverse charges on my account${ending}`,
    "",
    "Dear Sir or Madam,",
    "",
    `My ${bank} account${ending} was charged the following between ${day(report.from)} and ${day(report.to)}:`,
    "",
    ...lines,
    "",
    `Total charged: ${money(total)}${reversed > 0 ? ` (of which ${money(reversed)} has already been reversed)` : ""}`,
    "",
    "I request you to review these charges and reverse any that were applied in error, or waive them as a goodwill gesture.",
    ...(minBalance
      ? [
          "",
          "Under RBI's instructions on minimum balance charges, the bank should tell me of a shortfall before levying the charge, and the charge should not take the balance below zero. Please reverse any such charge that did not follow this.",
        ]
      : []),
    "",
    "Please reply with the outcome. Thank you.",
    "",
    "Regards,",
    holder || "[Your name]",
  ].join("\n");
}
