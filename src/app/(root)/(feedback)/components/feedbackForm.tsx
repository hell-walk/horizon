"use client";

import { Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { sendFeedback } from "@/lib/actions/feedback.action";
import { cn } from "@/lib/utils";

const KINDS = ["missing", "problem", "idea", "other"] as const;
const MIN = 10;
const MAX = 2000;

/** What kind, what to say, and whether the team may reply by email. */
const FeedbackForm = ({ from }: { from: string }) => {
  const t = useT();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("missing");
  const [message, setMessage] = useState("");
  const [mayReply, setMayReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await sendFeedback({ kind, message, page: from, mayReply });
      if (result.ok) {
        setSent(true);
        setMessage("");
      } else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <section className="panel max-w-2xl" role="status">
        <div className="panel-body flex flex-col items-start gap-3">
          <h2 className="font-display text-18 font-semibold text-ink">{t("feedback.thanksTitle")}</h2>
          <p className="text-14 text-ink">{t("feedback.thanksBody")}</p>
          <button type="button" onClick={() => setSent(false)} className="btn-ghost">
            {t("feedback.another")}
          </button>
        </div>
      </section>
    );
  }

  const length = message.trim().length;
  return (
    <form onSubmit={submit} className="panel max-w-2xl">
      <div className="panel-body flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="field-label mb-2">{t("feedback.kindLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <label
                key={k}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-13 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                  kind === k ? "border-ink bg-ink text-surface" : "border-line bg-surface-low text-ink hover:bg-surface-container"
                )}
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {t(`feedback.kind_${k}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="feedback-message">
            {t("feedback.messageLabel")}
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={MAX}
            placeholder={t(`feedback.placeholder_${kind}`)}
            className="field-input min-h-32 py-2"
            aria-describedby="feedback-count"
          />
          <p id="feedback-count" className="field-hint">
            {t("feedback.count", { count: length, max: MAX })}
          </p>
        </div>

        <label className="flex items-start gap-2 text-14 text-ink">
          <input type="checkbox" checked={mayReply} onChange={(e) => setMayReply(e.target.checked)} className="mt-1 size-4" />
          {t("feedback.mayReply")}
        </label>

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || length < MIN} className="btn-primary w-fit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {t("feedback.send")}
        </button>
        <p className="text-13 text-ink-muted">{t("feedback.privacy")}</p>
      </div>
    </form>
  );
};

export default FeedbackForm;
