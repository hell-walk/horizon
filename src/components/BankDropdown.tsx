"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { PROVIDER_LABELS } from "@/constants";
import { formUrlQuery, formatAmount, maskLabel } from "@/lib/utils";

export const BankDropdown = ({ accounts = [], setValue, otherStyles, initialId }: BankDropdownProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState(accounts.find((a) => a.appwriteItemId === initialId) ?? accounts[0]);

  const handleBankChange = (id: string) => {
    const account = accounts.find((a) => a.appwriteItemId === id)!;
    setSelected(account);

    const newUrl = formUrlQuery({ params: searchParams.toString(), key: "id", value: id });
    router.push(newUrl, { scroll: false });

    if (setValue) setValue("senderBank", id);
  };

  if (!selected) return null;

  return (
    <Select defaultValue={selected.appwriteItemId} onValueChange={handleBankChange}>
      <SelectTrigger className={`field-input justify-between ${otherStyles ?? ""}`}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{selected.name}</span>
          <span className="eyebrow">{maskLabel(selected.mask)}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="border-line bg-card" align="start">
        <SelectGroup>
          {accounts.map((account: Account) => (
            <SelectItem key={account.appwriteItemId} value={account.appwriteItemId} className="cursor-pointer">
              <div className="flex flex-col">
                <span className="text-14 font-semibold text-ink">{account.name}</span>
                <span className="eyebrow">
                  {maskLabel(account.mask)} · {PROVIDER_LABELS[account.provider]?.name ?? "Plaid"} ·{" "}
                  {formatAmount(account.currentBalance, account.currency)}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
