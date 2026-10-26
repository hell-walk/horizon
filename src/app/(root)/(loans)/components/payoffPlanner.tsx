"use client";

import { Calculator, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { useLocale, useT } from "@/components/providers/i18nProvider";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { saveLoanPlan } from "@/lib/actions/loan.action";
import { comparePayoff, outstandingFromSchedule, scheduleFrom, type LoanPlan } from "@/lib/finance/payoff";
import { formatAmount } from "@/lib/utils";

type Props = {
  loanKey: string;
  /** The EMI as the statements show it. */
  emi: number;
  currency: string;
  saved: LoanPlan | null;
  /** The lender's usual due day and cut-off day, when Horizon knows them. */
  dueDay?: number;
  cutoffDay?: number;
};

const toNumber = (s: string) => (s.trim() === "" ? undefined : Number(s));

/**
 * Under a loan: what the statements cannot show. When it was taken and for how
 * many months says how many EMIs are left and when it ends; the rate (and the
 * outstanding amount, estimated from those when not given) says what it still
 * costs, and how much sooner and cheaper it ends with extra money.
 */
const PayoffPlanner = ({ loanKey, emi: shownEmi, currency, saved, dueDay, cutoffDay }: Props) => {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(saved !== null);
  const [emi, setEmi] = useState(saved?.emi ? String(saved.emi) : String(Math.round(shownEmi)));
  const [borrowed, setBorrowed] = useState(saved?.borrowed ?? "");
  const [tenure, setTenure] = useState(saved?.tenure ? String(saved.tenure) : "");
  // The due day: the person's own answer first, then the lender's known day.
  const [dueDayText, setDueDayText] = useState(saved?.dueDay ? String(saved.dueDay) : dueDay ? String(dueDay) : "");
  const [outstanding, setOutstanding] = useState(saved?.outstanding ? String(saved.outstanding) : "");
  const [rate, setRate] = useState(saved?.annualRate !== undefined ? String(saved.annualRate) : "");
  const [extra, setExtra] = useState(saved?.extraMonthly ? String(saved.extraMonthly) : "");
  const [lump, setLump] = useState(saved?.lumpSum ? String(saved.lumpSum) : "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const money = (n: number) => formatAmount(Math.round(n), currency);
  // Dates in the person's language, here in the browser (the schedule can land on any day).
  const when = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const emiNumber = toNumber(emi);
  const schedule = useMemo(() => {
    const months = toNumber(tenure);
    if (!borrowed || months === undefined || !Number.isInteger(months) || months < 1) return null;
    const day = toNumber(dueDayText);
    return scheduleFrom({ borrowed, tenure: months, dueDay: day && day >= 1 && day <= 31 ? day : undefined, cutoffDay });
  }, [borrowed, tenure, dueDayText, cutoffDay]);
  const rateNumber = toNumber(rate);
  // The outstanding amount: typed, else worked out from the EMI, the rate and the months left.
  const estimatedOutstanding = useMemo(() => {
    if (outstanding.trim() !== "" || !schedule || rateNumber === undefined || !emiNumber) return undefined;
    return outstandingFromSchedule({ emi: emiNumber, annualRate: rateNumber, remaining: schedule.remaining });
  }, [outstanding, schedule, rateNumber, emiNumber]);
  const input = useMemo(() => {
    const o = toNumber(outstanding) ?? estimatedOutstanding;
    if (o === undefined || rateNumber === undefined || !emiNumber || !Number.isFinite(o) || o <= 0 || rateNumber < 0 || rateNumber > 60) return null;
    return { outstanding: o, annualRate: rateNumber, emi: emiNumber, extraMonthly: toNumber(extra) || undefined, lumpSum: toNumber(lump) || undefined };
  }, [outstanding, estimatedOutstanding, rateNumber, emiNumber, extra, lump]);
  const plan = useMemo(() => (input ? comparePayoff(input) : null), [input]);
  const withExtra = Boolean(input && (input.extraMonthly || input.lumpSum));
  const ownDueDay = toNumber(dueDayText);
  const dueDayOk = ownDueDay !== undefined && Number.isInteger(ownDueDay) && ownDueDay >= 1 && ownDueDay <= 31;
  const canSave = Boolean(input || schedule || dueDayOk);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const result = await saveLoanPlan({
        key: loanKey,
        plan: {
          outstanding: toNumber(outstanding),
          annualRate: rateNumber,
          extraMonthly: toNumber(extra) || undefined,
          lumpSum: toNumber(lump) || undefined,
          emi: emiNumber && Math.round(emiNumber) !== Math.round(shownEmi) ? emiNumber : undefined,
          borrowed: borrowed || undefined,
          tenure: toNumber(tenure),
          dueDay: dueDayOk ? ownDueDay : undefined,
        },
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`plan-emi-${loanKey}`} label={t("loans.planEmi")} value={emi} onChange={setEmi} />
        <div className="field">
          <label htmlFor={`plan-from-${loanKey}`} className="field-label">
            {t("loans.planBorrowed")}
          </label>
          <input
            id={`plan-from-${loanKey}`}
            type="date"
            value={borrowed}
            onChange={(e) => setBorrowed(e.target.value)}
            className="field-input font-mono"
            translate="no"
          />
        </div>
        <Field id={`plan-months-${loanKey}`} label={t("loans.planTenure")} value={tenure} onChange={setTenure} />
        <Field id={`plan-day-${loanKey}`} label={t("loans.planDueDay")} value={dueDayText} onChange={(v) => setDueDayText(v.slice(0, 2))} />
      </div>
      {schedule && (
        <p className="text-13 text-ink">
          {t("loans.planSchedule", { paid: schedule.paid, tenure: toNumber(tenure) ?? 0, remaining: schedule.remaining, date: when(schedule.endDate) })}
          {emiNumber ? ` ${t("loans.planRemainingTotal", { amount: money(emiNumber * schedule.remaining) })}` : ""}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`plan-rate-${loanKey}`} label={t("loans.planRate")} value={rate} onChange={setRate} decimal />
        <Field
          id={`plan-out-${loanKey}`}
          label={t("loans.planOutstanding")}
          value={outstanding}
          onChange={setOutstanding}
          placeholder={estimatedOutstanding !== undefined ? String(Math.round(estimatedOutstanding)) : undefined}
        />
        <Field id={`plan-extra-${loanKey}`} label={t("loans.planExtra")} value={extra} onChange={setExtra} />
        <Field id={`plan-lump-${loanKey}`} label={t("loans.planLump")} value={lump} onChange={setLump} />
      </div>
      {estimatedOutstanding !== undefined && (
        <p className="text-12 text-ink-muted">{t("loans.planOutstandingEstimated", { amount: money(estimatedOutstanding) })}</p>
      )}

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
        <button type="submit" disabled={!canSave || busy || pending} className="btn-primary btn-sm">
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
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
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
      placeholder={placeholder}
      className="field-input font-mono"
    />
  </div>
);

export default PayoffPlanner;
