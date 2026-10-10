import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatAmount, maskLabel } from "@/lib/utils";

// A translated label for a value that comes from data, or the value itself when there is no key for it.
const labelFor = (t: Translate, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};

// Every linked account as a table: bank, last 4 digits, how it is connected, type, balance.
// Rendered only by server pages (My banks, Connect bank), so it reads the language itself.
const AccountsTable = async ({ accounts, title }: { accounts: Account[]; title?: string }) => {
  const t = await getT();
  return (
    <section className="panel">
      <header className="panel-head">
        <span className="eyebrow">{title ?? t("banks.connectedAccounts")}</span>
        <span className="eyebrow text-ink">{accounts.length}</span>
      </header>
      {accounts.length === 0 ? (
        <p className="panel-body text-14 text-ink-muted">{t("banks.noAccounts")}</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("banks.tableScrolls")}>
          <table className="w-full text-14">
            <thead>
              <tr className="border-b border-line">
                <th className="eyebrow px-4 py-2.5 text-left font-normal">{t("banks.colBank")}</th>
                <th className="eyebrow px-4 py-2.5 text-left font-normal">{t("banks.lastDigits")}</th>
                <th className="eyebrow px-4 py-2.5 text-left font-normal">{t("banks.colConnection")}</th>
                <th className="eyebrow px-4 py-2.5 text-left font-normal max-md:hidden">{t("banks.accountType")}</th>
                <th className="eyebrow px-4 py-2.5 text-right font-normal">{t("banks.balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {accounts.map((account) => {
                const providerKey = account.provider in PROVIDER_LABELS ? account.provider : "plaid";
                const provider = PROVIDER_LABELS[providerKey];
                const subtype = account.subtype ?? "";
                return (
                  <tr key={account.appwriteItemId} className="transition-colors hover:bg-surface-low">
                    <td className="px-4 py-3 font-semibold text-ink">
                      <Link href={`/transaction-history/?id=${account.appwriteItemId}`} className="hover:underline" translate="no">
                        {account.name}
                      </Link>
                    </td>
                    <td translate="no" className="px-4 py-3 font-mono text-12 text-ink-muted">
                      {maskLabel(account.mask)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="chip">
                        <span className="dot bg-lime" />
                        {labelFor(t, `banks.provider_${providerKey}`, provider.name)} · {labelFor(t, `banks.mode_${providerKey}`, provider.mode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-muted max-md:hidden">
                      {subtype && labelFor(t, `banks.type_${subtype.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, subtype)}
                    </td>
                    <td translate="no" className="amount px-4 py-3 text-right font-semibold text-ink">
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
};

export default AccountsTable;
