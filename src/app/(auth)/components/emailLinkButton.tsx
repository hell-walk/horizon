"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useT } from "@/components/i18nProvider";
import { openEmailLink } from "@/lib/actions/user.action";

/** The one click that opens an emailed link (see auth/confirm/page.tsx for why a click). */
const EmailLinkButton = ({ tokenHash, type, kind }: { tokenHash: string; type: string; kind: "email" | "recovery" }) => {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await openEmailLink({ tokenHash, type });
      if (result.ok) {
        // A full load: the new session cookie must reach every part of the app.
        window.location.assign(result.next);
        return;
      }
      setError(result.error);
    } catch {
      setError(t("common.tryAgain"));
    }
    setBusy(false);
  };

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t(kind === "recovery" ? "auth.eyebrowReset" : "auth.eyebrowCheckEmail")}</p>
        <h1 className="h-display">{t(kind === "recovery" ? "auth.linkHeadingReset" : "auth.linkHeadingConfirm")}</h1>
        <p className="text-14 text-ink-muted">{t(kind === "recovery" ? "auth.linkIntroReset" : "auth.linkIntroConfirm")}</p>
      </header>
      {error ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
            {error}
          </p>
          <Link href={kind === "recovery" ? "/forgot-password" : "/sign-up"} className="btn-ghost">
            {t(kind === "recovery" ? "auth.linkAskNewReset" : "auth.linkAskNewConfirm")} <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <button type="button" onClick={open} disabled={busy} className="btn-primary h-12 w-full justify-between px-5">
          <span className="flex items-center gap-2">
            <span className="size-2 bg-lime" />
            {busy ? t("auth.working") : t(kind === "recovery" ? "auth.linkButtonReset" : "auth.linkButtonConfirm")}
          </span>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
      )}
    </section>
  );
};

export default EmailLinkButton;
