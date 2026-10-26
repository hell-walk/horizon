"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/providers/i18nProvider";
import { salaryCandidate, setIncome } from "@/lib/actions/income.action";
import { INCOME_KINDS, type IncomeKind } from "@/lib/finance/income";
import { cn, formatAmount } from "@/lib/utils";

type Candidate = { payee: string; monthly: number; months: number; confidence: "high" | "medium"; payDay?: number };
type Payer = { payee: string; total: number; months: number };
type Lookup = { status: "idle" | "looking" | "failed" } | { status: "ready"; candidates: Candidate[]; payers: Payer[] };

/**
 * "How do you earn?": four choices, and for a freelancer a monthly figure.
 * Open on its own when nothing is known yet; otherwise a "Change" link.
 *
 * Picking "salaried" verifies first, then asks: Horizon looks through the
 * statements for credits that look like a salary and asks about each, best
 * first ("Is this your salary?"). A "no" moves to the next one; when none is
 * it, the person picks their salary from everyone who sent money in. Only a
 * credit they said yes to, or picked, can be saved as the salary, and the
 * server checks it is in their statements. Then the pay day.
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
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [step, setStep] = useState(0);
  const [picking, setPicking] = useState(false);
  const [noneOfThese, setNoneOfThese] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [payDay, setPayDay] = useState(savedPayDay ? String(savedPayDay) : "");
  const [figure, setFigure] = useState(declared ? String(declared) : "");
  const [side, setSide] = useState(savedSide ? String(savedSide) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const money = (n: number) => formatAmount(n, currency);

  const pick = (option: IncomeKind) => {
    setKind(option);
    setError(null);
    if (option !== "salaried") return;
    setChosen(null);
    setRejected([]);
    setStep(0);
    setPicking(false);
    setNoneOfThese(false);
    setLookup({ status: "looking" });
    salaryCandidate()
      .then((found) => setLookup(found.ok ? { status: "ready", candidates: found.candidates, payers: found.payers } : { status: "failed" }))
      .catch(() => setLookup({ status: "failed" }));
  };

  const ready = lookup.status === "ready" ? lookup : null;
  const asking = ready && !chosen && !picking ? ready.candidates[step] : undefined;
  // Everyone who sent money in, less the ones already turned down.
  const others = ready ? ready.payers.filter((p) => !rejected.includes(p.payee)) : [];
  const showList = ready && !chosen && !asking && !noneOfThese && others.length > 0;
  const nothing = kind === "salaried" && (lookup.status === "failed" || (ready && !chosen && !asking && (noneOfThese || others.length === 0)));
  const payDayOk = /^([1-9]|[12]\d|3[01])$/.test(payDay);

  const confirm = (payee: string, day?: number) => {
    setChosen(payee);
    if (day && !savedPayDay) setPayDay(String(day));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind || (kind === "salaried" && !(chosen && payDayOk))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setIncome({
        kind,
        declared: kind === "freelancer" && figure ? Number(figure) : null,
        side: kind === "salaried" && side ? Number(side) : null,
        payDay: kind === "salaried" && payDayOk ? Number(payDay) : null,
        salaryPayee: kind === "salaried" ? chosen : null,
        rejected: kind === "salaried" ? rejected : null,
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

      {kind === "salaried" && lookup.status === "looking" && (
        <p className="flex items-center gap-2 text-13 text-ink-muted">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> {t("home.incomeEmployerLooking")}
        </p>
      )}

      {/* Verify, then ask: one likely salary credit at a time. */}
      {kind === "salaried" && asking && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-low p-3" aria-live="polite">
          <p className="text-14 text-ink">{t("home.incomeEmployerSeen", { payee: asking.payee, amount: money(asking.monthly), count: asking.months })}</p>
          {asking.confidence === "medium" && <p className="text-12 text-ink-muted">{t("home.incomeNoWording")}</p>}
          <p className="text-14 font-semibold text-ink">{t("home.incomeEmployerAsk")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => confirm(asking.payee, asking.payDay)} className="btn-primary btn-sm">
              {t("home.incomeYes")}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejected((r) => [...r, asking.payee]);
                setStep((s) => s + 1);
              }}
              className="btn-secondary btn-sm"
            >
              {t("home.incomeNo")}
            </button>
          </div>
        </div>
      )}

      {/* None of those: the person picks their salary from everyone who sent money in. */}
      {kind === "salaried" && showList && (
        <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-low p-2">
          <p className="eyebrow px-2 py-1">{t("home.incomePickTitle")}</p>
          {others.map((p) => (
            <button
              key={p.payee}
              type="button"
              onClick={() => confirm(p.payee)}
              className="flex items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-14 text-ink transition-colors hover:bg-card"
            >
              <span translate="no">{p.payee}</span>
              <span className="shrink-0 text-12 text-ink-muted">{t("home.incomePickLine", { total: money(p.total), count: p.months })}</span>
            </button>
          ))}
          <button type="button" onClick={() => setNoneOfThese(true)} className="btn-ghost btn-sm w-fit">
            {t("home.incomePickNone")}
          </button>
        </div>
      )}

      {nothing && (
        <p role="alert" className="flex items-start gap-2 text-13 text-warn-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("home.incomeEmployerNone")}</span>
        </p>
      )}

      {kind === "salaried" && chosen && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-13 text-ink">
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            <span>{t("home.incomeChosen", { payee: chosen })}</span>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setPicking(true);
                setNoneOfThese(false);
              }}
              className="btn-ghost btn-sm"
            >
              {t("home.incomeChange")}
            </button>
          </p>
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
        </>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={!kind || (kind === "salaried" && !(chosen && payDayOk)) || busy || pending} className="btn-primary btn-sm">
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
