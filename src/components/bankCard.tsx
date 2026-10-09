import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";
import { formatAmount } from "@/lib/utils";

import Copy from "./Copy";

// Black card for one account. Links to that account's transaction history.
const BankCard = ({ account, userName, showBalance = true, withCopy = true }: CreditCardProps) => {
  const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;

  return (
    <div className="flex w-full flex-col gap-3">
      <Link
        href={`/transaction-history/?id=${account.appwriteItemId}`}
        className="relative flex min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-lg bg-black p-5 text-white ring-1 ring-white/10 transition-shadow hover:shadow-lift"
      >
        <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border border-white/10" />
        <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-white/10" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-14 font-bold uppercase tracking-tight">Horizon</span>
            <span className="eyebrow truncate text-white/60">{account.name}</span>
          </div>
          <span className="chip border-lime bg-lime text-[#171E00]">{provider.name}</span>
        </div>

        <p className="amount text-20 tracking-[0.2em]">
          <span className="opacity-50">•••• •••• ••••</span> {account.mask || "0000"}
        </p>

        <div className="flex items-end justify-between gap-3">
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
