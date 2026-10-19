"use client";

import { Calculator, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { saveLoanPlan } from "@/lib/actions/loan.action";
import { comparePayoff, type LoanPlan } from "@/lib/payoff";
import { formatAmount } from "@/lib/utils";

type Props = {
  loanKey: string;
  emi: number;
  currency: string;
  saved: LoanPlan | null;
  /** The person's own language's date for YYYY-MM-DD, done on the server. */
  dates: Record<string, string>;
};

const toNumber = (s: string) => (s.trim() === "" ? undefined : Number(s));

/**
 * The payoff planner under a loan: the outstanding amount and the rate (which
 * the statements do not show), then how long the loan runs at the EMI being
 * paid, and how much sooner and cheaper it ends with extra money.
 */
const PayoffPlanner = ({ loanKey, emi, currency, saved, dates }: Props) => {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(saved !== null);
  const [outstanding, setOutstanding] = useState(saved ? String(saved.outstanding) : "");
  const [rate, setRate] = useState(saved ? String(saved.annualRate) : "");
  const [extra, setExtra] = useState(saved?.extraMonthly ? String(saved.extraMonthly) : "");
  const [lump, setLump] = useState(saved?.lumpSum ? String(saved.lumpSum) : "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const money = (n: number) => formatAmount(Math.round(n), currency);
  const input = useMemo(() => {
    const o = toNumber(outstanding);
    const r = toNumber(rate);
    if (o === undefined || r === undefined || !Number.isFinite(o) || !Number.isFinite(r) || o <= 0 || r < 0 || r > 60) return null;
    return { outstanding: o, annualRate: r, emi, extraMonthly: toNumber(extra) || undefined, lumpSum: toNumber(lump) || undefined };
  }, [outstanding, rate, extra, lump, emi]);
  const plan = useMemo(() => (input ? comparePayoff(input) : null), [input]);
  const when = (iso: string) => dates[iso] ?? iso;
  const withExtra = Boolean(input && (input.extraMonthly || input.lumpSum));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!input) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const result = await saveLoanPlan({
        key: loanKey,
        plan: { outstanding: input.outstanding, annualRate: input.annualRate, extraMonthly: input.extraMonthly, lumpSum: input.lumpSum },
      });
      if (result.ok) {
        setDone(true);
        startTransition(() => router.refresh());
      } else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm w-fit">
        <Calculator className="size-3.5" aria-hidden /> {t("loans.planTitle")}
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-md border border-line bg-surface-low p-4">
      <p className="flex items-center gap-2 text-14 font-semibold text-ink">
        <Calculator className="size-4" aria-hidden /> {t("loans.planTitle")}
      </p>
      <p className="text-13 text-ink-muted">{t("loans.planIntro")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`plan-out-${loanKey}`} label={t("loans.planOutstanding")} value={outstanding} onChange={setOutstanding} />
        <Field id={`plan-rate-${loanKey}`} label={t("loans.planRate")} value={rate} onChange={setRate} decimal />
        <Field id={`plan-extra-${loanKey}`} label={t("loans.planExtra")} value={extra} onChange={setExtra} />
        <Field id={`plan-lump-${loanKey}`} label={t("loans.planLump")} value={lump} onChange={setLump} />
      </div>

      {!input ? (
        <p className="text-13 text-ink-muted">{t("loans.planNeed")}</p>
      ) : !plan ? (
        <p className="text-13 text-warn-ink">{t("loans.planNoCover")}</p>
      ) : (
        <div className="flex flex-col gap-1.5 text-13">
          <p className="text-ink">
            {t("loans.planBaseline", { months: plan.baseline.months, interest: money(plan.baseline.interest), date: when(plan.baseline.payoffDate) })}
          </p>
          {withExtra && (
            <>
              <p className="text-ink">
                {t("loans.planFaster", { months: plan.faster.months, interest: money(plan.faster.interest), date: when(plan.faster.payoffDate) })}
              </p>
              <p className="font-semibold text-success">{t("loans.planSaves", { interest: money(plan.interestSaved), months: plan.monthsSaved })}</p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!input || busy || pending} className="btn-primary btn-sm">
          {busy || pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : done ? <Check className="size-3.5" aria-hidden /> : null}{" "}
          {t("loans.planSave")}
        </button>
        {done && !busy && !pending && <span className="text-12 text-ink-muted">{t("loans.planSaved")}</span>}
        {error && (
          <span role="alert" className="field-error">
            {error}
          </span>
        )}
      </div>
    </form>
  );
};

const Field = ({
  id,
  label,
  value,
  onChange,
  decimal = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
}) => (
  <div className="field">
    <label htmlFor={id} className="field-label">
      {label}
    </label>
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /[^\d]/g, "").slice(0, 12))}
      inputMode="decimal"
      translate="no"
      className="field-input font-mono"
    />
  </div>
);

export default PayoffPlanner;
