"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn, maskLabel } from "@/lib/utils";

type Account = { id: string; name: string; mask: string };

/**
 * The upload card's two doors, side by side: a statement for a new account,
 * or more statements for one already here. The second opens the list of
 * statement accounts underneath, full width, to pick from first.
 */
const UploadChoice = ({ accounts, labels }: { accounts: Account[]; labels: { newAccount: string; existing: string; pick: string } }) => {
  const [open, setOpen] = useState(false);
  // Long labels wrap rather than spill out of a half-width button.
  const button = "h-auto min-h-10 whitespace-normal py-2 text-center leading-tight";
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3", accounts.length > 0 && "sm:grid-cols-2")}>
        <Link href="/upload-statement" className={cn("btn-primary w-full", button)}>
          {labels.newAccount}
        </Link>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="upload-existing"
            className={cn("btn-secondary w-full", button)}
          >
            {labels.existing}
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div id="upload-existing" className="flex flex-col gap-1 rounded-md border border-line bg-surface-low p-2">
          <p className="eyebrow px-2 py-1">{labels.pick}</p>
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/upload-statement?account=${a.id}`}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-2 text-14 text-ink transition-colors hover:bg-card"
            >
              <span translate="no">{a.name}</span>
              <span translate="no" className="font-mono text-12 text-ink-muted">
                {maskLabel(a.mask)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadChoice;
