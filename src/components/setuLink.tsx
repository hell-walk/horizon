"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { createSetuConsent } from "@/lib/actions/setu.action";
import { cn } from "@/lib/utils";

import { useT } from "./i18nProvider";
import { Input } from "./ui/input";

type Props = {
  user: User;
  variant?: "primary" | "card";
};

/**
 * "Connect Indian bank" button. Asks for the customer's mobile number, starts a
 * Setu consent on the server and sends the browser to the AA approval page.
 * The AA redirects back to /setu/callback when the customer is done.
 */
const SetuLink = ({ user, variant = "card" }: Props) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createSetuConsent({ mobile });
      if (result && "url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      setError((result && "error" in result && result.error) || t("connect.setuCouldNotStart"));
    } catch {
      setError(t("common.notReachable"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(variant === "primary" ? "btn-accent h-12 w-full" : "btn-accent w-full")}
        aria-expanded={open}
      >
        {t("connect.setuOpen")} <ArrowRight className="size-4" />
      </button>

      {open && (
        <form
          className="flex flex-col gap-3 rounded-md border border-line bg-surface-low p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <label className="field-label" htmlFor="setu-mobile">
            {t("connect.setuMobileLabel")}
          </label>
          <Input
            id="setu-mobile"
            inputMode="numeric"
            placeholder={t("connect.setuMobilePlaceholder")}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="field-input font-mono"
            autoComplete="tel-national"
          />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" disabled={loading || mobile.trim().length < 10} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {t("connect.setuStarting")}
              </>
            ) : (
              t("connect.setuContinue")
            )}
          </button>
          <p className="field-hint">
            {t("connect.setuHint", { name: user.firstName ?? "Horizon" })}
          </p>
        </form>
      )}
    </div>
  );
};

export default SetuLink;
