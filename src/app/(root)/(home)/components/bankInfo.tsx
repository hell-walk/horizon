"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/components/i18nProvider";
import { PROVIDER_LABELS } from "@/constants";
import { rememberAccount } from "@/lib/selectedAccount";
import { cn, formUrlQuery, formatAmount, maskLabel } from "@/lib/utils";

// One account row. Clicking it selects that account on the current page.
const BankInfo = ({ account, appwriteItemId, type }: BankInfoProps) => {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const isActive = appwriteItemId === account?.appwriteItemId;
  const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;

  const handleBankChange = () => {
    rememberAccount(account?.appwriteItemId);
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
        <span translate="no" className="truncate text-14 font-semibold text-ink">
          {account.name}
        </span>
        <span className="eyebrow">
          <span translate="no">{maskLabel(account.mask)}</span> · {t(provider.nameKey)}
          {type === "full" && ` · ${account.subtype}`}
        </span>
      </span>
      <span translate="no" className="amount shrink-0 text-14 font-semibold text-ink">{formatAmount(account.currentBalance, account.currency)}</span>
    </button>
  );
};

export default BankInfo;
