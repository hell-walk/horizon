"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { setIncome } from "@/lib/actions/income.action";
import { INCOME_KINDS, type IncomeKind } from "@/lib/income";
import { cn } from "@/lib/utils";

/**
 * "How do you earn?": four choices, and for a freelancer a monthly figure.
 * Open on its own when nothing is known yet; otherwise a "Change" link.
 */
const IncomeChooser = ({ current, declared, side: savedSide }: { current: IncomeKind | null; declared?: number; side?: number }) => {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(current === null);
  const [kind, setKind] = useState<IncomeKind | null>(current);
  const [figure, setFigure] = useState(declared ? String(declared) : "");
  const [side, setSide] = useState(savedSide ? String(savedSide) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setIncome({
        kind,
        declared: kind === "freelancer" && figure ? Number(figure) : null,
        side: kind === "salaried" && side ? Number(side) : null,
      });
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
        {t("home.incomeChange")}
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("auth.incomeKind")} className="flex flex-wrap gap-2">
        {INCOME_KINDS.map((option) => {
          const on = option === kind;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(option)}
              className={cn("chip cursor-pointer transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary")}
            >
              {t(`common.incomeKind_${option}`)}
            </button>
          );
        })}
      </div>
      {kind === "freelancer" && (
        <div className="field max-w-xs">
          <label htmlFor="income-figure" className="field-label">
            {t("home.incomeDeclaredLabel")}
          </label>
          <input
            id="income-figure"
            value={figure}
            onChange={(e) => setFigure(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
            inputMode="numeric"
            translate="no"
            className="field-input font-mono"
          />
        </div>
      )}
      {kind === "salaried" && (
        <div className="field max-w-xs">
          <label htmlFor="income-side" className="field-label">
            {t("home.incomeSideLabel")}
          </label>
          <input
            id="income-side"
            value={side}
            onChange={(e) => setSide(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
            inputMode="numeric"
            translate="no"
            className="field-input font-mono"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!kind || busy || pending} className="btn-primary btn-sm">
          {(busy || pending) && <Loader2 className="size-3.5 animate-spin" />} {t("home.incomeSave")}
        </button>
        {current !== null && (
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
            {t("common.cancel")}
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

export default IncomeChooser;
