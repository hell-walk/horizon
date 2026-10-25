"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { setRechargeDays } from "@/lib/actions/recharge.action";

/** "Set the days": how long one recharge of this operator lasts, which fixes what a month costs and when the next is due. */
const RechargeDays = ({ operator, days }: { operator: string; days?: number }) => {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(days ? String(days) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ok = /^([1-9]\d?|[1-3]\d\d|400)$/.test(value);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setRechargeDays({ operator, days: Number(value) });
      if (result.ok) {
        setOpen(false);
        startTransition(() => router.refresh());
      } else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm">
        <Pencil className="size-3.5" aria-hidden /> {t("loans.rechargeDaysButton")}
      </button>
    );
  }
  const working = busy || pending;
  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2 border-t border-line pt-3">
      <label htmlFor={`recharge-days-${operator}`} className="field-label">
        {t("loans.rechargeDaysLabel", { operator })}
      </label>
      <input
        id={`recharge-days-${operator}`}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        inputMode="numeric"
        autoFocus
        translate="no"
        className="field-input w-24 font-mono"
      />
      <p className="text-12 text-ink-muted">{t("loans.rechargeDaysHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!ok || working} className="btn-primary btn-sm">
          {working && <Loader2 className="size-3.5 animate-spin" aria-hidden />} {t("history.editSave")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={working} className="btn-ghost btn-sm">
          {t("common.cancel")}
        </button>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
};

export default RechargeDays;
