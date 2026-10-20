"use client";

import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18nProvider";
import { flipToAccount } from "@/lib/accountFlip";
import { pageFollowsAccount, rememberAccount } from "@/lib/selectedAccount";
import { cn, formatAmount, formUrlQuery, maskLabel } from "@/lib/utils";

/** What the switcher needs to know about an account: the rest stays on the server. */
export type SwitchAccount = Pick<Account, "appwriteItemId" | "name" | "mask" | "currentBalance" | "currency">;

// The same easing as the light/dark pill, so the highlight glides the same way.
const SLIDE: React.CSSProperties = { transitionDuration: "600ms", transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" };

/**
 * The accounts as a list in the profile panel, with a highlight that slides to
 * the chosen one. Picking an account remembers it for the whole app and, at
 * once, the page grows out of the tapped row (lib/accountFlip) with the panel
 * gone; the page then follows: a new ?id= where the page shows one account, a
 * refresh elsewhere.
 */
const BankSwitch = ({ accounts, activeId, onPicked }: { accounts: SwitchAccount[]; activeId?: string; onPicked?: () => void }) => {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The page's own ?id= is the truth when it has one: the cookie only catches up after the page loads.
  const fromUrl = searchParams.get("id");
  const [active, setActive] = useState(accounts.some((a) => a.appwriteItemId === fromUrl) ? fromUrl! : activeId);
  const listRef = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<{ top: number; height: number } | null>(null);

  // Where the active row sits, so the highlight can slide to it. offsetTop is
  // unaffected by the panel's own slide-in transform.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>("[data-active]");
    setMark(row ? { top: row.offsetTop, height: row.offsetHeight } : null);
  }, [active]);

  if (accounts.length < 2) return null;

  const pick = (id: string, row: Element) => {
    if (id === active) return;
    setActive(id);
    rememberAccount(id);
    const from = row.getBoundingClientRect(); // taken now: the row leaves with the panel
    // Pages that follow ?id=: fetched from the tap, so the page is ready by the time the sweep ends.
    const url = pageFollowsAccount(pathname) ? formUrlQuery({ params: searchParams.toString(), key: "id", value: id }) : null;
    if (url) router.prefetch(url, { kind: "full" as PrefetchKind });
    const go = () => {
      if (url) router.push(url, { scroll: false });
      else router.refresh();
    };
    flipToAccount(from, () => onPicked?.(), go);
  };

  return (
    <section aria-label={t("nav.switchAccount")} className="flex flex-col gap-2">
      <span className="eyebrow">{t("nav.switchAccount")}</span>
      <div ref={listRef} role="radiogroup" aria-label={t("nav.switchAccount")} className="relative flex flex-col rounded-md border border-line bg-card p-1">
        {mark && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-sm bg-primary transition-[top,height]"
            style={{ top: mark.top, height: mark.height, ...SLIDE }}
          />
        )}
        {accounts.map((account) => {
          const on = account.appwriteItemId === active;
          return (
            <button
              key={account.appwriteItemId}
              type="button"
              role="radio"
              aria-checked={on}
              data-active={on || undefined}
              onClick={(e) => pick(account.appwriteItemId, e.currentTarget)}
              style={SLIDE}
              className={cn(
                "relative z-10 flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors",
                on ? "text-primary-foreground" : "text-ink hover:bg-surface-low",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span translate="no" className="truncate text-14 font-semibold">
                  {account.name}
                </span>
                <span translate="no" className={cn("font-mono text-12", on ? "text-primary-foreground/70" : "text-ink-muted")}>
                  {maskLabel(account.mask)}
                </span>
              </span>
              <span translate="no" className="amount shrink-0 text-13 font-semibold">
                {formatAmount(account.currentBalance, account.currency)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default BankSwitch;
