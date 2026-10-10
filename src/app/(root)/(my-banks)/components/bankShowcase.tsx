"use client";

import { ArrowLeftRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";

import { useT } from "@/components/i18nProvider";
import { PROVIDER_LABELS } from "@/constants";
import type { Translate } from "@/lib/i18n/translate";
import { formatAmount, maskLabel } from "@/lib/utils";

import CardDesignPicker from "./cardDesignPicker";
import CardStack from "@/components/cardStack";
import Copy from "@/components/Copy";
import { canTransfer } from "@/lib/transfers";
import SpendingThin, { SpendingThinSkeleton, type SpendingByAccount } from "./spendingThin";

// A translated label for a value that comes from data, or the value itself when there is no key for it.
const labelFor = (t: Translate, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};

// My Banks: the card deck on the left, the selected account's details on the
// right. Clicking a card behind swaps it forward and the details follow.
const BankShowcase = ({
  accounts,
  holder,
  spending,
  initialId,
}: {
  accounts: Account[];
  holder: string;
  spending: Promise<SpendingByAccount>;
  initialId?: string; // the app-wide active account
}) => {
  const t = useT();
  const [selectedId, setSelectedId] = useState(initialId ?? accounts[0]?.appwriteItemId);
  // Designs picked on this page show at once, before the save comes back.
  const [designs, setDesigns] = useState<Record<string, string>>({});
  const withDesigns = accounts.map((a) => (designs[a.appwriteItemId] ? { ...a, cardDesign: designs[a.appwriteItemId] } : a));
  const account = withDesigns.find((a) => a.appwriteItemId === selectedId) ?? withDesigns[0];
  if (!account) return null;

  const providerKey = account.provider in PROVIDER_LABELS ? account.provider : "plaid";
  const provider = PROVIDER_LABELS[providerKey];
  const accountType = `${account.subtype || account.type}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
      <section className="flex flex-col gap-3">
        <CardStack accounts={withDesigns} selected={selectedId} userName={holder} onChange={setSelectedId} />
        <Suspense fallback={<SpendingThinSkeleton />}>
          <SpendingThin spending={spending} accountId={account.appwriteItemId} />
        </Suspense>
      </section>

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">{t("banks.selectedAccount")}</span>
          <span className="chip">
            <span className="dot bg-lime" />
            {labelFor(t, `banks.provider_${providerKey}`, provider.name)} · {labelFor(t, `banks.mode_${providerKey}`, provider.mode)}
          </span>
        </header>
        <div className="panel-body flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 translate="no" className="font-display text-20 font-semibold tracking-tight text-ink">
              {account.name}
            </h2>
            <p translate="no" className="text-13 text-ink-muted">
              {account.officialName}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fact label={t("banks.balance")} value={formatAmount(account.currentBalance, account.currency)} mono />
            <Fact label={t("banks.available")} value={formatAmount(account.availableBalance ?? account.currentBalance, account.currency)} mono />
            <Fact label={t("banks.lastDigits")} value={maskLabel(account.mask)} mono />
            <Fact label={t("banks.accountType")} value={labelFor(t, `banks.type_${accountType.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, accountType)} />
          </dl>

          {/* The receiving code only means something where money can be sent (US accounts via Plaid). */}
          {canTransfer(account) && <Copy title={account.sharableId} />}

          <CardDesignPicker
            account={account}
            onPick={(design) => setDesigns((d) => ({ ...d, [account.appwriteItemId]: design }))}
          />

          <div className={canTransfer(account) ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
            <Link href={`/transaction-history/?id=${account.appwriteItemId}`} className="btn-secondary">
              <ReceiptText className="size-4" /> {t("banks.viewEntries")}
            </Link>
            {canTransfer(account) && (
              <Link href={`/payment-transfer/?id=${account.appwriteItemId}`} className="btn-primary">
                <ArrowLeftRight className="size-4" /> {t("banks.sendMoney")}
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const Fact = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="eyebrow">{label}</dt>
    <dd translate={mono ? "no" : undefined} className={`truncate text-14 font-semibold capitalize text-ink ${mono ? "amount" : ""}`}>
      {value}
    </dd>
  </div>
);

export default BankShowcase;
