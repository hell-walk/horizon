"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PROVIDER_LABELS } from "@/constants";
import { cn, formUrlQuery, formatAmount, maskLabel } from "@/lib/utils";

// One account row. Clicking it selects that account on the current page.
const BankInfo = ({ account, appwriteItemId, type }: BankInfoProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = appwriteItemId === account?.appwriteItemId;
  const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;

  const handleBankChange = () => {
    const newUrl = formUrlQuery({ params: searchParams.toString(), key: "id", value: account?.appwriteItemId });
    router.push(newUrl, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={handleBankChange}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
        isActive ? "border-primary bg-surface-low" : "border-line bg-card hover:bg-surface-low"
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-14 font-semibold text-ink">{account.name}</span>
        <span className="eyebrow">
          {maskLabel(account.mask)} · {provider.name}
          {type === "full" && ` · ${account.subtype}`}
        </span>
      </span>
      <span className="amount shrink-0 text-14 font-semibold text-ink">{formatAmount(account.currentBalance, account.currency)}</span>
    </button>
  );
};

export default BankInfo;
