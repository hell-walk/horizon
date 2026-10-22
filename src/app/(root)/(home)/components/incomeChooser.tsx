"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { salaryCandidate, setIncome } from "@/lib/actions/income.action";
import { INCOME_KINDS, type IncomeKind } from "@/lib/income";
import { cn, formatAmount } from "@/lib/utils";

type Employer = { payee: string; monthly: number; months: number; payDay?: number };

/**
 * "How do you earn?": four choices, and for a freelancer a monthly figure.
 * Open on its own when nothing is known yet; otherwise a "Change" link.
 * Picking "salaried" first looks for the employer in the statements; the
 * choice can only be saved once one is found (the server checks too), and
 * then asks which day the salary arrives, so the forecast can run pay day
 * to pay day.
 */
const IncomeChooser = ({
  current,
  declared,
  side: savedSide,
  payDay: savedPayDay,
  currency,
}: {
  current: IncomeKind | null;
  declared?: number;
  side?: number;
  payDay?: number;
  currency: string;
}) => {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(current === null);
  const [kind, setKind] = useState<IncomeKind | null>(current);
  const [employer, setEmployer] = useState<Employer | "looking" | "none" | null>(null);
  const [payDay, setPayDay] = useState(savedPayDay ? String(savedPayDay) : "");
  const [figure, setFigure] = useState(declared ? String(declared) : "");
  const [side, setSide] = useState(savedSide ? String(savedSide) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const pick = (option: IncomeKind) => {
    setKind(option);
    setError(null);
    if (option !== "salaried") return;
    setEmployer("looking");
    salaryCandidate()
      .then((found) => {
        setEmployer(found.ok ? found : "none");
        // The day the employer's last credit arrived, unless the person already gave a day.
        if (found.ok && found.payDay && !savedPayDay) setPayDay(String(found.payDay));
      })
      .catch(() => setEmployer("none"));
  };
  const employerFound = typeof employer === "object" && employer !== null;
  const payDayOk = /^([1-9]|[12]\d|3[01])$/.test(payDay);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind || (kind === "salaried" && !(employerFound && payDayOk))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setIncome({
        kind,
        declared: kind === "freelancer" && figure ? Number(figure) : null,
        side: kind === "salaried" && side ? Number(side) : null,
        payDay: kind === "salaried" && payDayOk ? Number(payDay) : null,
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
              onClick={() => pick(option)}
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
      {kind === "salaried" && employer === "looking" && (
        <p className="flex items-center gap-2 text-13 text-ink-muted">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> {t("home.incomeEmployerLooking")}
        </p>
      )}
      {kind === "salaried" && employer === "none" && (
        <p role="alert" className="flex items-start gap-2 text-13 text-warn-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("home.incomeEmployerNone")}</span>
        </p>
      )}
      {kind === "salaried" && employerFound && (
        <p className="flex items-start gap-2 text-13 text-ink">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{" "}
          <span>{t("home.incomeEmployerFound", { payee: employer.payee, amount: formatAmount(employer.monthly, currency), count: employer.months })}</span>
        </p>
      )}
      {kind === "salaried" && employerFound && (
        <div className="field max-w-xs">
          <label htmlFor="income-payday" className="field-label">
            {t("home.incomePayDayLabel")}
          </label>
          <input
            id="income-payday"
            value={payDay}
            onChange={(e) => setPayDay(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            inputMode="numeric"
            translate="no"
            required
            aria-invalid={payDay !== "" && !payDayOk}
            className="field-input w-20 font-mono"
          />
        </div>
      )}
      {kind === "salaried" && employerFound && (
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
        <button type="submit" disabled={!kind || (kind === "salaried" && !(employerFound && payDayOk)) || busy || pending} className="btn-primary btn-sm">
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
