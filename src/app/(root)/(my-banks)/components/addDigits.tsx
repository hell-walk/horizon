"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { setAccountDigits } from "@/lib/actions/card.action";

/** For an imported account whose statement did not show its number: add the last 4 digits once. */
const AddDigits = ({ appwriteItemId }: { appwriteItemId: string }) => {
  const t = useT();
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await setAccountDigits({ appwriteItemId, digits });
      if (result.ok) startTransition(() => router.refresh());
      else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-md border border-warn/40 bg-warn-soft p-3">
      <label htmlFor={`digits-${appwriteItemId}`} className="text-13 text-warn-ink">
        {t("banks.digitsHint")}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`digits-${appwriteItemId}`}
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="1234"
          translate="no"
          className="field-input w-24 font-mono"
          aria-describedby={error ? `digits-error-${appwriteItemId}` : undefined}
        />
        <button type="submit" disabled={digits.length !== 4 || busy || pending} className="btn-primary btn-sm">
          {(busy || pending) && <Loader2 className="size-3.5 animate-spin" />} {t("banks.digitsSave")}
        </button>
      </div>
      {error && (
        <p id={`digits-error-${appwriteItemId}`} role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
};

export default AddDigits;
