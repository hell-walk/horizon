"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/providers/i18nProvider";

/** The request to the bank: shown as it will be sent, with a button that copies it. */
const RequestLetter = ({ text }: { text: string }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an old browser, or permission refused): the text is on screen to select.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <pre
        lang="en"
        translate="no"
        className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-card p-3 font-mono text-12 leading-relaxed text-ink"
      >
        {text}
      </pre>
      <button type="button" onClick={copy} className="btn-secondary w-fit">
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? t("charges.copied") : t("charges.copy")}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t("charges.copied") : ""}
      </span>
    </div>
  );
};

export default RequestLetter;
