"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { rememberAccount } from "@/lib/selectedAccount";
import { cn, formUrlQuery, maskLabel } from "@/lib/utils";

// Chip-style tab for switching the selected account.
export const BankTabItem = ({ account, appwriteItemId }: BankTabItemProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isActive = appwriteItemId === account?.appwriteItemId;

  const handleBankChange = () => {
    rememberAccount(account?.appwriteItemId);
    const newUrl = formUrlQuery({ params: searchParams.toString(), key: "id", value: account?.appwriteItemId });
    router.push(newUrl, { scroll: false });
  };

  return (
    <div
      onClick={handleBankChange}
      className={cn(
        "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
        isActive ? "border-primary bg-primary text-primary-foreground" : "border-line bg-card text-ink-muted hover:bg-surface-container"
      )}
    >
      <span className="max-w-[140px] truncate">{account.name}</span>
      <span className="opacity-60">{maskLabel(account.mask)}</span>
    </div>
  );
};
