"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { rememberAccount } from "@/lib/selectedAccount";
import { cn, formUrlQuery, maskLabel } from "@/lib/utils";

import BankCard from "./bankCard";
import { useT } from "./i18nProvider";

const CARD_HEIGHT = 190;
const STEP = 30; // vertical offset between stacked cards: the strip you can click
const MAX_VISIBLE = 3;

type Props = {
  accounts: Account[];
  selected?: string; // appwriteItemId of the card in front
  userName: string;
  // "url" writes the selection to ?id= so the rest of the page follows;
  // "local" only tells the parent through onChange.
  mode?: "url" | "local";
  onChange?: (appwriteItemId: string) => void;
};

/**
 * Overlapping deck of bank cards, like the tutorial's sidebar: the selected
 * account sits in front, the others peek out behind it. Clicking a card behind
 * brings it forward and selects that account.
 */
const CardStack = ({ accounts, selected, userName, mode = "local", onChange }: Props) => {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [front, setFront] = useState(selected ?? accounts[0]?.appwriteItemId);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);

  // Follow the selection made elsewhere on the page (tabs, account rows):
  // React's "adjust state while rendering" pattern, no effect needed.
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected) setFront(selected);
  }

  if (accounts.length === 0) return null;

  const ordered = [...accounts].sort((a, b) => (a.appwriteItemId === front ? -1 : b.appwriteItemId === front ? 1 : 0));
  const visible = ordered.slice(0, MAX_VISIBLE);

  const bringForward = (id: string) => {
    if (id === front) return;
    setFront(id);
    rememberAccount(id); // the whole app follows the card in front
    onChange?.(id);
    if (mode === "url") {
      router.push(formUrlQuery({ params: searchParams.toString(), key: "id", value: id }), { scroll: false });
    }
  };

  // Previous / next in the accounts' own order, wrapping round.
  const step = (dir: 1 | -1) => {
    const n = accounts.length;
    const at = Math.max(0, accounts.findIndex((a) => a.appwriteItemId === front));
    bringForward(accounts[(at + dir + n) % n].appwriteItemId);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="relative w-full touch-pan-y"
        style={{ height: CARD_HEIGHT + (visible.length - 1) * STEP }}
        // Swipe left / right on touch screens to change card.
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          swiped.current = false;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null || accounts.length < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) {
            swiped.current = true;
            step(dx < 0 ? 1 : -1);
          }
        }}
        // A swipe must not also open the front card's ledger.
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {visible.map((account, i) => {
          const isFront = i === 0;
          return (
            <div
              key={account.appwriteItemId}
              onClickCapture={
                isFront
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bringForward(account.appwriteItemId);
                    }
              }
              role={isFront ? undefined : "button"}
              tabIndex={isFront ? undefined : 0}
              onKeyDown={
                isFront
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        bringForward(account.appwriteItemId);
                      }
                    }
              }
              aria-label={isFront ? undefined : t("banks.showAccount", { name: account.name })}
              className={cn(
                "absolute inset-x-0 top-0 origin-top transition-[transform,opacity,filter] duration-500",
                isFront ? "z-30" : "cursor-pointer [&_a]:ring-white/25 hover:[&_a]:ring-lime",
                i === 1 && "z-20",
                i === 2 && "z-10"
              )}
              style={{
                // Shrink sideways only, so the full strip below the front card stays visible.
                transform: `translateY(${i * STEP}px) scaleX(${1 - i * 0.05})`,
                opacity: isFront ? 1 : 0.92 - i * 0.12,
                transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              {/* Behind the front card the whole card is one button; a link inside it would be a control within a control. */}
              <BankCard account={account} userName={userName} withCopy={false} linked={isFront} />
            </div>
          );
        })}
      </div>

      {accounts.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={t("banks.previousAccount")}
            className="flex-center size-8 rounded-full border border-line bg-card text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center" role="group" aria-label={t("banks.accounts")}>
            {accounts.map((a) => {
              const active = a.appwriteItemId === front;
              return (
                <button
                  key={a.appwriteItemId}
                  type="button"
                  onClick={() => bringForward(a.appwriteItemId)}
                  aria-label={`${a.name} ${maskLabel(a.mask)}`}
                  aria-pressed={active}
                  className="group flex h-6 min-w-6 items-center justify-center"
                >
                  <span className={cn("h-1.5 rounded-full transition-all duration-300", active ? "w-5 bg-lime" : "w-1.5 bg-line group-hover:bg-ink-faint")} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={t("banks.nextAccount")}
            className="flex-center size-8 rounded-full border border-line bg-card text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CardStack;
