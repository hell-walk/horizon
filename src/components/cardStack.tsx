"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn, formUrlQuery } from "@/lib/utils";

import BankCard from "./bankCard";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [front, setFront] = useState(selected ?? accounts[0]?.appwriteItemId);

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
    onChange?.(id);
    if (mode === "url") {
      router.push(formUrlQuery({ params: searchParams.toString(), key: "id", value: id }), { scroll: false });
    }
  };

  return (
    <div className="relative w-full" style={{ height: CARD_HEIGHT + (visible.length - 1) * STEP }}>
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
            aria-label={isFront ? undefined : `Show ${account.name}`}
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
            <BankCard account={account} userName={userName} withCopy={false} />
          </div>
        );
      })}
    </div>
  );
};

export default CardStack;
