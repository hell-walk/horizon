"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { flipToAccount } from "@/lib/accountFlip";
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
  const deckRef = useRef<HTMLDivElement>(null);
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

  // The page grows out of whatever was tapped (`from`): a card behind, an arrow, a dot, or the deck itself after a swipe.
  const bringForward = (id: string, from?: Element | null) => {
    if (id === front) return;
    const go = () => {
      setFront(id);
      rememberAccount(id); // the whole app follows the card in front
      onChange?.(id);
    };
    // The rest of the page follows through the address: fetched from the tap, during the sweep, and shown once it ends.
    let follow: (() => void) | undefined;
    if (mode === "url") {
      const url = formUrlQuery({ params: searchParams.toString(), key: "id", value: id });
      router.prefetch(url, { kind: "full" as PrefetchKind });
      follow = () => router.push(url, { scroll: false });
    }
    flipToAccount(from ?? deckRef.current, go, follow);
  };

  // Previous / next in the accounts' own order, wrapping round.
  const step = (dir: 1 | -1, from?: Element | null) => {
    const n = accounts.length;
    const at = Math.max(
      0,
      accounts.findIndex((a) => a.appwriteItemId === front),
    );
    bringForward(accounts[(at + dir + n) % n].appwriteItemId, from);
  };

  return (
    <div className="flex w-full flex-col gap-3" data-tour="cards">
      <div
        ref={deckRef}
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
        {/* Back to front in the DOM: the account flip stacks each card's layer in DOM order, so the card coming forward must come last. */}
        {[...visible].reverse().map((account) => {
          const i = visible.indexOf(account);
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
                      bringForward(account.appwriteItemId, e.currentTarget);
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
                        bringForward(account.appwriteItemId, e.currentTarget);
                      }
                    }
              }
              aria-label={isFront ? undefined : t("banks.showAccount", { name: account.name })}
              className={cn(
                "absolute inset-x-0 top-0 origin-top transition-[transform,opacity,filter] duration-500",
                isFront ? "z-30" : "cursor-pointer [&_a]:ring-white/25 hover:[&_a]:ring-lime",
                i === 1 && "z-20",
                i === 2 && "z-10",
              )}
              style={{
                // Shrink sideways only, so the full strip below the front card stays visible.
                transform: `translateY(${i * STEP}px) scaleX(${1 - i * 0.05})`,
                transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                // Its own layer in the account flip (globals.css), so it glides to its new place in the deck.
                viewTransitionName: `card-${account.appwriteItemId}`,
                // "front" is read from the new deck, so the card coming forward is stacked on top while it glides (globals.css).
                viewTransitionClass: isFront ? "card front" : "card back",
              }}
            >
              {/* Behind the front card the whole card is one button; a link inside it would be a control within a control. */}
              <BankCard account={account} userName={userName} withCopy={false} linked={isFront} />
              {/* Cards behind sit in shade. A tint rather than translucency: the account flip moves each card as its own
                  layer, and a see-through card would ghost over the others on the way. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg bg-black transition-opacity duration-500"
                style={{ opacity: isFront ? 0 : 0.18 + i * 0.14, transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
              />
            </div>
          );
        })}
      </div>

      {accounts.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={(e) => step(-1, e.currentTarget)}
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
                  onClick={(e) => bringForward(a.appwriteItemId, e.currentTarget)}
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
            onClick={(e) => step(1, e.currentTarget)}
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
