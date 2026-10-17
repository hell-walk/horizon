"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18nProvider";
import { unsubscribeEmail } from "@/lib/actions/notify.action";

/** Turns email reminders off for the person the signed link names. */
const UnsubscribeButton = ({ u, signature }: { u: string; signature: string }) => {
  const t = useT();
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    setState("working");
    setError(null);
    try {
      const result = await unsubscribeEmail({ u, t: signature });
      if (result.ok) setState("done");
      else {
        setError(result.error);
        setState("idle");
      }
    } catch {
      setError(t("common.notReachable"));
      setState("idle");
    }
  };

  if (state === "done") return <p role="status">{t("remind.unsubDone")}</p>;
  return (
    <div className="not-prose flex flex-col gap-3">
      <button type="button" onClick={stop} disabled={state === "working"} className="btn-primary w-fit">
        {state === "working" && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("remind.unsubButton")}
      </button>
      {error && (
        <p role="alert" className="text-14 text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default UnsubscribeButton;
