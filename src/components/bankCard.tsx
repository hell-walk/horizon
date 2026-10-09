import { Nfc } from "lucide-react";
import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";
import { cardBackground, resolveCardDesign } from "@/lib/cardDesigns";
import { formatAmount } from "@/lib/utils";

import Copy from "./Copy";

// Gold contact chip, drawn so it scales crisply at any size.
const Chip = () => (
  <svg viewBox="0 0 34 26" className="h-[22px] w-[29px]" aria-hidden="true">
    <defs>
      <linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6dd8f" />
        <stop offset="0.5" stopColor="#d6ae4b" />
        <stop offset="1" stopColor="#b98a2c" />
      </linearGradient>
    </defs>
    <rect x="0.5" y="0.5" width="33" height="25" rx="5" fill="url(#chip-gold)" stroke="#8a6620" strokeOpacity="0.5" />
    <path d="M0.5 9h10m13 0h10M0.5 17h10m13 0h10M10.5 0.5v25m13-25v25M10.5 13h13" stroke="#7a5a1c" strokeOpacity="0.55" fill="none" />
  </svg>
);

/**
 * One account as a card. The skin is the account's chosen design: its bank's
 * colours, an unbranded theme, or Classic black (see lib/cardDesigns). Links
 * to that account's transaction history.
 */
const BankCard = ({ account, userName, showBalance = true, withCopy = true }: CreditCardProps) => {
  const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;
  const design = resolveCardDesign(account);
  const isClassic = design.kind === "classic";

  return (
    <div className="flex w-full flex-col gap-3">
      <Link
        href={`/transaction-history/?id=${account.appwriteItemId}`}
        style={{ background: cardBackground(design) }}
        className="relative flex min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-lg p-5 text-white ring-1 ring-white/10 transition-shadow hover:shadow-lift"
      >
        {isClassic ? (
          <>
            <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border border-white/10" />
            <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-white/10" />
          </>
        ) : (
          // A soft sheen across the split, like the showcase cards.
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
        )}

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-14 font-bold uppercase tracking-tight">Horizon</span>
            <span className="eyebrow truncate text-white/60">{account.name}</span>
          </div>
          {design.kind === "bank" ? (
            <span className="font-display text-16 font-bold uppercase tracking-tight">{design.label}</span>
          ) : (
            <span className="chip border-lime bg-lime text-[#171E00]">{provider.name}</span>
          )}
        </div>

        <div className="relative flex items-center gap-2.5">
          <Chip />
          <Nfc className="size-4 text-white/70" strokeWidth={1.75} />
          {design.kind === "bank" && <span className="chip ml-auto border-white/30 bg-white/10 text-white">{provider.name}</span>}
        </div>

        <p className="amount relative text-18 tracking-[0.2em]">
          <span className="opacity-60">•••• •••• ••••</span> {account.mask || "0000"}
        </p>

        <div className="relative flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="eyebrow text-white/60">Holder</span>
            <span className="truncate font-mono text-12 uppercase">{userName}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="eyebrow text-white/60">{showBalance ? "Balance" : "Currency"}</span>
            <span className="amount text-14 font-semibold">
              {showBalance ? formatAmount(account.currentBalance, account.currency) : account.currency || "USD"}
            </span>
          </div>
        </div>
      </Link>

      {showBalance && withCopy && <Copy title={account.sharableId} />}
    </div>
  );
};

export default BankCard;
