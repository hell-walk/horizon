import { CircleAlert, CircleCheck, FileUp } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import { accountCoverage, STALE_DAYS } from "@/lib/server/coverage";
import { maskKnown, maskLabel } from "@/lib/utils";

/**
 * What each uploaded account's entries cover and where they have holes, so the
 * charts can be trusted (or not). Only accounts from statements: a linked bank
 * keeps itself complete.
 */
const CoveragePanel = async ({ accounts }: { accounts: Account[] }) => {
  const imported = accounts.filter((a) => a.provider === "manual");
  if (imported.length === 0) return null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const items = await Promise.all(
    imported.map(async (account) => ({ account, coverage: await accountCoverage(account.appwriteItemId, account.id, account.currency).catch(() => null) })),
  );

  return (
    <section className="panel" aria-labelledby="coverage-title">
      <header className="panel-head">
        <h2 id="coverage-title" className="eyebrow">
          {t("banks.coverageTitle")}
        </h2>
      </header>
      <div className="panel-body flex flex-col gap-4">
        <p className="text-13 text-ink-muted">{t("banks.coverageIntro")}</p>
        <ul className="flex flex-col divide-y divide-line">
          {items.map(({ account, coverage }) => {
            const stale = coverage !== null && coverage.sinceLatest > STALE_DAYS;
            const fine = coverage !== null && coverage.holes.length === 0 && !stale;
            return (
              <li key={account.appwriteItemId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span translate="no" className="truncate text-14 font-semibold text-ink">
                      {account.name}
                    </span>
                    {maskKnown(account.mask) && (
                      <span translate="no" className="font-mono text-12 text-ink-muted">
                        {maskLabel(account.mask)}
                      </span>
                    )}
                  </span>
                  <Link href={`/upload-statement?account=${account.appwriteItemId}`} className="btn-ghost btn-sm">
                    <FileUp className="size-3.5" aria-hidden /> {t("banks.coverageAdd")}
                  </Link>
                </div>
                {coverage ? (
                  <p className="text-13 text-ink-muted">
                    {t("banks.coverageRange", { from: day(coverage.from), to: day(coverage.to) })} · {t("banks.coverageEntries", { count: coverage.count })}
                  </p>
                ) : (
                  <p className="text-13 text-ink-muted">{t("banks.coverageNone")}</p>
                )}
                {coverage && (
                  <ul className="flex flex-col gap-1.5">
                    {coverage.holes.map((hole) => (
                      <li key={`${hole.from}-${hole.reason}`} className="flex items-start gap-2 text-13 text-warn-ink">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          {hole.reason === "dates"
                            ? t("banks.coverageHoleDates", { from: day(hole.from), to: day(hole.to), days: hole.days })
                            : t("banks.coverageHoleBalance", { from: day(hole.from), to: day(hole.to) })}
                        </span>
                      </li>
                    ))}
                    {stale && (
                      <li className="flex items-start gap-2 text-13 text-warn-ink">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{t("banks.coverageLatestOld", { date: day(coverage.to), days: coverage.sinceLatest })}</span>
                      </li>
                    )}
                    {fine && (
                      <li className="flex items-start gap-2 text-13 text-success">
                        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{t("banks.coverageOk")}</span>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default CoveragePanel;
