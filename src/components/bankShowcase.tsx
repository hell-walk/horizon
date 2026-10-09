"use client";

import { ArrowLeftRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";

import { PROVIDER_LABELS } from "@/constants";
import { formatAmount, maskLabel } from "@/lib/utils";

import CardStack from "./cardStack";
import Copy from "./Copy";
import SpendingThin, { SpendingThinSkeleton, type SpendingByAccount } from "./spendingThin";

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
  const [selectedId, setSelectedId] = useState(initialId ?? accounts[0]?.appwriteItemId);
  const account = accounts.find((a) => a.appwriteItemId === selectedId) ?? accounts[0];
  if (!account) return null;

  const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
      <section className="flex flex-col gap-3">
        <CardStack accounts={accounts} selected={selectedId} userName={holder} onChange={setSelectedId} />
        <Suspense fallback={<SpendingThinSkeleton />}>
          <SpendingThin spending={spending} accountId={account.appwriteItemId} />
        </Suspense>
        {accounts.length > 1 && <p className="eyebrow text-center">Tap a card behind to bring it forward</p>}
      </section>

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">Selected account</span>
          <span className="chip">
            <span className="dot bg-lime" />
            {provider.name} · {provider.mode}
          </span>
        </header>
        <div className="panel-body flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-20 font-semibold tracking-tight text-ink">{account.name}</h2>
            <p className="text-13 text-ink-muted">{account.officialName}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fact label="Balance" value={formatAmount(account.currentBalance, account.currency)} mono />
            <Fact label="Available" value={formatAmount(account.availableBalance ?? account.currentBalance, account.currency)} mono />
            <Fact label="Account" value={maskLabel(account.mask)} mono />
            <Fact label="Type" value={`${account.subtype || account.type}`} />
          </dl>

          <Copy title={account.sharableId} />

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/transaction-history/?id=${account.appwriteItemId}`} className="btn-secondary">
              <ReceiptText className="size-4" /> View ledger
            </Link>
            <Link href={`/payment-transfer/?id=${account.appwriteItemId}`} className="btn-primary">
              <ArrowLeftRight className="size-4" /> Transfer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const Fact = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="eyebrow">{label}</dt>
    <dd className={`truncate text-14 font-semibold capitalize text-ink ${mono ? "amount" : ""}`}>{value}</dd>
  </div>
);

export default BankShowcase;
