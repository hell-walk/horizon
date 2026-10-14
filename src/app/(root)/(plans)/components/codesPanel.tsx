"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useLocale, useT } from "@/components/i18nProvider";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { applyCode } from "@/lib/actions/plan.action";

/** "Have a code?" (promo or a friend's referral) and the person's own referral code to share. */
const CodesPanel = ({ referralCode, referralDays }: { referralCode: string | null; referralDays: number }) => {
  const t = useT();
  const locale = useLocale();
  // Dates are formatted here: a server page cannot hand a function to the browser.
  const dateOf = (ms: number) => new Date(ms).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric" });
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  const apply = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await applyCode({ code });
      if (result.ok) {
        setMessage({ text: t("plan.codeApplied", { days: result.freeDays, date: dateOf(result.until) }), bad: false });
        setCode("");
        startTransition(() => router.refresh());
      } else setMessage({ text: result.error, bad: true });
    } catch {
      setMessage({ text: t("common.notReachable"), bad: true });
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form onSubmit={apply} className="panel">
        <div className="panel-body flex flex-col gap-3">
          <h2 className="eyebrow text-ink">{t("plan.codeTitle")}</h2>
          <p className="text-13 text-ink-muted">{t("plan.codeHint")}</p>
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={32}
              placeholder={t("plan.codePlaceholder")}
              aria-label={t("plan.codeTitle")}
              autoComplete="off"
              translate="no"
              className="field-input min-w-0 flex-1 font-mono uppercase"
            />
            <button type="submit" disabled={busy || code.trim().length < 4} className="btn-primary btn-sm">
              {busy && <Loader2 className="size-3.5 animate-spin" />} {t("plan.codeApply")}
            </button>
          </div>
          {message && (
            <p role={message.bad ? "alert" : "status"} className={message.bad ? "field-error" : "text-14 text-ink"}>
              {message.text}
            </p>
          )}
        </div>
      </form>

      {referralCode && (
        <section className="panel">
          <div className="panel-body flex flex-col gap-3">
            <h2 className="eyebrow text-ink">{t("plan.referralTitle")}</h2>
            <p className="text-13 text-ink-muted">{t("plan.referralBody", { days: referralDays })}</p>
            <div className="flex items-center gap-2">
              <span translate="no" className="field-input flex flex-1 items-center font-mono text-16 font-semibold tracking-wider text-ink">
                {referralCode}
              </span>
              <button type="button" onClick={copy} className="btn-secondary btn-sm" aria-live="polite">
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{" "}
                {copied ? t("plan.referralCopied") : t("plan.referralCopy")}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default CodesPanel;
