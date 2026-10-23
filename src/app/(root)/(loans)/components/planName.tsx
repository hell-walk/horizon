"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { namePlan } from "@/lib/actions/correction.action";
import { PLAN_NAMES } from "@/lib/planNames";

/**
 * Names one subscription: a pencil, then a small form with Horizon's guesses
 * from the price to pick from (or any name typed). The name is stored for
 * this payee at this price, so it shows everywhere the payment appears and
 * holds for the next statement too.
 */
const PlanName = ({ accountId, txId, named, guesses }: { accountId: string; txId: string; named: boolean; guesses: string[] }) => {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(guesses[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listId = `plan-names-${txId}`;

  const send = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await namePlan({ accountId, transactionId: txId, name });
      if (result.ok) {
        setOpen(false);
        startTransition(() => router.refresh());
      } else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) void send(value.trim());
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm">
        <Pencil className="size-3.5" aria-hidden /> {t("loans.subsName")}
      </button>
    );
  }
  const working = busy || pending;
  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2 border-t border-line pt-3">
      <label htmlFor={`plan-name-${txId}`} className="field-label">
        {t("loans.subsNameLabel")}
      </label>
      <input
        id={`plan-name-${txId}`}
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 60))}
        autoFocus
        translate="no"
        className="field-input max-w-xs"
      />
      <datalist id={listId}>
        {[...new Set([...guesses, ...PLAN_NAMES])].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p className="text-12 text-ink-muted">{t("loans.subsNameHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!value.trim() || working} className="btn-primary btn-sm">
          {working && <Loader2 className="size-3.5 animate-spin" aria-hidden />} {t("history.editSave")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={working} className="btn-ghost btn-sm">
          {t("common.cancel")}
        </button>
        {named && (
          <button type="button" onClick={() => void send("")} disabled={working} className="btn-ghost btn-sm">
            {t("loans.subsNameClear")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
};

export default PlanName;
