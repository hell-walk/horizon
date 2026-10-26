"use client";

import { Check, Copy as CopyIcon, Mail } from "lucide-react";
import { useState } from "react";

import { useT } from "../../../components/providers/i18nProvider";

/** The support address as a button: one click copies it, and the button says so for two seconds. */
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
      className="btn-accent btn-sm my-1 inline-flex max-w-full gap-2 align-middle"
    >
      <Mail className="size-4 shrink-0" aria-hidden />
      <span translate="no" className="truncate font-mono normal-case tracking-normal">
        {address}
      </span>
      <span className="flex shrink-0 items-center gap-1 border-l border-current/30 pl-2" aria-live="polite">
        {copied ? <Check className="size-3.5" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}
        {copied ? t("banks.copied") : t("common.copy")}
      </span>
    </button>
  );
};

export default CopyEmail;
