"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "../ui/select";
import { useT } from "@/components/i18nProvider";
import { PROVIDER_LABELS } from "@/constants";
import { rememberAccount } from "@/lib/selectedAccount";
import { formUrlQuery, formatAmount, maskLabel } from "@/lib/utils";

export const BankDropdown = ({ accounts = [], setValue, otherStyles, initialId }: BankDropdownProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useT();
  const [selected, setSelected] = useState(accounts.find((a) => a.appwriteItemId === initialId) ?? accounts[0]);

  const handleBankChange = (id: string) => {
    const account = accounts.find((a) => a.appwriteItemId === id)!;
    setSelected(account);
    rememberAccount(id);

    const newUrl = formUrlQuery({ params: searchParams.toString(), key: "id", value: id });
    router.push(newUrl, { scroll: false });

    if (setValue) setValue("senderBank", id);
  };

  if (!selected) return null;

  return (
    <Select defaultValue={selected.appwriteItemId} onValueChange={handleBankChange}>
      <SelectTrigger aria-label={t("transfer.accountToSendFrom")} className={`field-input justify-between ${otherStyles ?? ""}`}>
        <span className="flex min-w-0 items-center gap-2">
          <span translate="no" className="truncate font-semibold">
            {selected.name}
          </span>
          <span translate="no" className="eyebrow">
            {maskLabel(selected.mask)}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent className="border-line bg-card" align="start">
        <SelectGroup>
          {accounts.map((account: Account) => (
            <SelectItem key={account.appwriteItemId} value={account.appwriteItemId} className="cursor-pointer">
              <div className="flex flex-col">
                <span translate="no" className="text-14 font-semibold text-ink">
                  {account.name}
                </span>
                <span className="eyebrow">
                  <span translate="no">{maskLabel(account.mask)}</span> ·{" "}
                  {PROVIDER_LABELS[account.provider] ? t(PROVIDER_LABELS[account.provider].nameKey) : "Plaid"} ·{" "}
                  <span translate="no">{formatAmount(account.currentBalance, account.currency)}</span>
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
