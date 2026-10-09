"use client";

import { Check, Copy as CopyIcon } from "lucide-react";
import { useState } from "react";

// Copies the account's sharable id, which another user pastes into the transfer form.
const Copy = ({ title }: { title: string }) => {
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(title);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2 text-left transition-colors hover:bg-surface-container"
    >
      <span className="flex min-w-0 flex-col">
        <span className="eyebrow">Sharable id</span>
        <span className="truncate font-mono text-12 text-ink">{title}</span>
      </span>
      {hasCopied ? <Check className="size-4 shrink-0 text-success" /> : <CopyIcon className="size-4 shrink-0 text-ink-faint" />}
    </button>
  );
};

export default Copy;
