"use client";

import { Check, Copy as CopyIcon } from "lucide-react";
import { useState } from "react";

import { useT } from "./i18nProvider";

/** The support address: one click copies it, and says so for two seconds. */
const CopyEmail = ({ address }: { address: string }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(address).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title={t("banks.copied")}
      translate="no"
      className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-card px-2 py-0.5 align-baseline font-mono text-[0.9em] text-ink transition-colors hover:bg-surface-container"
    >
      {address}
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <CopyIcon className="size-3.5 text-ink-faint" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? t("banks.copied") : ""}
      </span>
    </button>
  );
};

export default CopyEmail;
