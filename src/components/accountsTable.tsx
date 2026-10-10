import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";
import { formatAmount, maskLabel } from "@/lib/utils";

// Every linked account as a table: institution, mask, provider, type, balance.
const AccountsTable = ({ accounts, title = "Connected accounts" }: { accounts: Account[]; title?: string }) => (
  <section className="panel">
    <header className="panel-head">
      <span className="eyebrow">{title}</span>
      <span className="eyebrow text-ink">{String(accounts.length).padStart(2, "0")}</span>
    </header>
    {accounts.length === 0 ? (
      <p className="panel-body text-14 text-ink-muted">No accounts linked yet.</p>
    ) : (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scrolls sideways">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-4 py-2.5 text-left font-normal">Institution</th>
              <th className="eyebrow px-4 py-2.5 text-left font-normal">Account</th>
              <th className="eyebrow px-4 py-2.5 text-left font-normal">Provider</th>
              <th className="eyebrow px-4 py-2.5 text-left font-normal max-md:hidden">Type</th>
              <th className="eyebrow px-4 py-2.5 text-right font-normal">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {accounts.map((account) => {
              const provider = PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid;
              return (
                <tr key={account.appwriteItemId} className="transition-colors hover:bg-surface-low">
                  <td className="px-4 py-3 font-semibold text-ink">
                    <Link href={`/transaction-history/?id=${account.appwriteItemId}`} className="hover:underline">
                      {account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-12 text-ink-muted">{maskLabel(account.mask)}</td>
                  <td className="px-4 py-3">
                    <span className="chip">
                      <span className="dot bg-lime" />
                      {provider.name} · {provider.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-ink-muted max-md:hidden">{account.subtype}</td>
                  <td className="amount px-4 py-3 text-right font-semibold text-ink">
                    {formatAmount(account.currentBalance, account.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default AccountsTable;
