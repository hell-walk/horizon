"use client";

import { CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { useLocale, useT } from "@/components/i18nProvider";
import { deleteGoal } from "@/lib/actions/goal.action";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { planGoal, type Goal, type UsualLeftOver } from "@/lib/goals";
import { cn, formatAmount } from "@/lib/utils";

import GoalForm from "./goalForm";

type Props = { goals: Goal[]; leftOver: UsualLeftOver[]; currencies: string[]; thisMonth: string };

const toNumber = (text: string) => Math.max(0, Number(text.replace(/,/g, "")) || 0);

/**
 * The goals, each with its plan written out as a sum, and "what if": save a
 * bit more each month, or a cost goes up. Everything is worked out here from
 * the user's own numbers, as they type.
 */
const GoalsBoard = ({ goals, leftOver, currencies, thisMonth }: Props) => {
  const t = useT();
  const locale = useLocale();
  const ids = useId();
  const [editing, setEditing] = useState<string | "new" | null>(goals.length === 0 ? "new" : null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [costUp, setCostUp] = useState("");
  // The actions redraw the page themselves; the form only has to close.
  const finished = () => setEditing(null);
  const [deleting, startDelete] = useTransition();

  const monthName = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", year: "numeric", timeZone: "UTC" });
  const month = (m: string) => monthName.format(new Date(`${m}-01T00:00:00Z`));
  const extraMonthly = toNumber(extra);
  const costMonthly = toNumber(costUp);
  const whatIf = extraMonthly > 0 || costMonthly > 0;

  const remove = (id: string) => {
    setError(null);
    startDelete(async () => {
      try {
        const result = await deleteGoal({ id });
        if (!result.ok) setError(result.error);
        setConfirming(null);
      } catch {
        setError(t("common.notReachable"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* What the user usually has left: the ceiling for what goals can ask. */}
      <section className="panel panel-body text-14 text-ink">
        {leftOver.length === 0 ? (
          <p className="text-ink-muted">{t("goals.leftUnknown")}</p>
        ) : (
          leftOver.map((l) => (
            <p key={l.currency}>{t("goals.leftUsual", { amount: formatAmount(l.amount, l.currency), months: l.months.map(month).join(", ") })}</p>
          ))
        )}
      </section>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {goals.map((goal) => {
          const money = (n: number) => formatAmount(n, goal.currency);
          const plan = planGoal(goal, thisMonth);
          const ifPlan = whatIf ? planGoal(goal, thisMonth, extraMonthly) : null;
          const share = Math.min(100, (goal.saved / goal.target) * 100);
          return (
            <li key={goal.id} className="panel">
              {editing === goal.id ? (
                <div className="panel-body">
                  <GoalForm goal={goal} currencies={currencies} thisMonth={thisMonth} onDone={finished} />
                </div>
              ) : (
                <div className="panel-body flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 translate="no" className="font-display text-18 font-semibold text-ink">
                      {goal.name}
                    </h2>
                    <span translate="no" className="amount text-14 text-ink-muted">
                      {money(goal.saved)} / {money(goal.target)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface-container"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share)}
                    aria-label={t("goals.progress", { percent: Math.round(share) })}
                  >
                    <div className="h-full rounded-full bg-lime" style={{ width: `${share}%` }} />
                  </div>

                  {plan.done ? (
                    <p className="flex items-center gap-2 text-14 text-success">
                      <CheckCircle2 className="size-4" aria-hidden /> {t("goals.done")}
                    </p>
                  ) : (
                    <>
                      {plan.reachedIn && (
                        <p className="text-14 text-ink">
                          {t("goals.reachedIn", { monthly: money(goal.monthly!), month: month(plan.reachedIn), count: plan.monthsNeeded! })}
                        </p>
                      )}
                      {plan.neededMonthly !== undefined && (
                        <p className="text-14 text-ink">
                          {t("goals.neededBy", { by: month(goal.by!), needed: money(plan.neededMonthly), count: plan.monthsLeft! })}
                        </p>
                      )}
                      {plan.onTrack !== undefined && (
                        <p className={cn("flex items-center gap-2 text-13", plan.onTrack ? "text-success" : "text-danger")}>
                          {plan.onTrack ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
                          {plan.onTrack ? t("goals.onTrack") : t("goals.notOnTrack", { short: money(plan.neededMonthly! - goal.monthly!) })}
                        </p>
                      )}
                      {!plan.reachedIn && plan.neededMonthly === undefined && <p className="text-13 text-ink-muted">{t("goals.addMonthly")}</p>}
                      <p className="text-12 text-ink-muted" translate="no">
                        {money(goal.target)} − {money(goal.saved)} = {money(plan.remaining)} {t("goals.stillToSave")}
                        {plan.monthsNeeded ? ` · ${money(plan.remaining)} ÷ ${money(goal.monthly!)} = ${plan.monthsNeeded} ${t("goals.monthsWord")}` : ""}
                        {plan.neededMonthly !== undefined ? ` · ${money(plan.remaining)} ÷ ${plan.monthsLeft} = ${money(plan.neededMonthly)}` : ""}
                      </p>
                      {ifPlan?.reachedIn && (
                        <p className="rounded-md bg-lime/20 px-3 py-2 text-13 text-ink">
                          {t("goals.ifReached", { month: month(ifPlan.reachedIn), count: ifPlan.monthsNeeded! })}
                          {plan.monthsNeeded && ifPlan.monthsNeeded! < plan.monthsNeeded
                            ? ` ${t("goals.ifSooner", { count: plan.monthsNeeded - ifPlan.monthsNeeded! })}`
                            : ""}
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(goal.id)} className="btn-ghost btn-sm">
                      <Pencil className="size-3.5" aria-hidden /> {t("goals.edit")}
                    </button>
                    {confirming === goal.id ? (
                      <>
                        <span className="text-13 text-ink">{t("goals.deleteSure")}</span>
                        <button type="button" onClick={() => remove(goal.id)} disabled={deleting} className="btn-secondary btn-sm text-danger">
                          {deleting ? t("goals.deleting") : t("goals.deleteYes")}
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="btn-ghost btn-sm">
                          {t("common.cancel")}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirming(goal.id)} className="btn-ghost btn-sm">
                        <Trash2 className="size-3.5" aria-hidden /> {t("goals.delete")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing === "new" ? (
        <section className="panel panel-body flex flex-col gap-3">
          <h2 className="font-display text-18 font-semibold text-ink">{t("goals.newTitle")}</h2>
          <GoalForm currencies={currencies} thisMonth={thisMonth} onDone={finished} />
        </section>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn-secondary w-fit">
          <Plus className="size-4" aria-hidden /> {t("goals.addAnother")}
        </button>
      )}

      {goals.length > 0 && (
        <section className="panel" aria-labelledby={`${ids}-whatif`}>
          <header className="panel-head">
            <h2 id={`${ids}-whatif`} className="eyebrow text-ink">
              {t("goals.whatIfTitle")}
            </h2>
          </header>
          <div className="panel-body flex flex-col gap-3 text-14">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label className="field-label" htmlFor={`${ids}-extra`}>
                  {t("goals.whatIfExtra")}
                </label>
                <input
                  id={`${ids}-extra`}
                  inputMode="decimal"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="field-input"
                  placeholder="5000"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${ids}-cost`}>
                  {t("goals.whatIfCost")}
                </label>
                <input
                  id={`${ids}-cost`}
                  inputMode="decimal"
                  value={costUp}
                  onChange={(e) => setCostUp(e.target.value)}
                  className="field-input"
                  placeholder="2000"
                />
              </div>
            </div>
            <div aria-live="polite" className="flex flex-col gap-1">
              {extraMonthly > 0 && <p className="text-ink">{t("goals.whatIfExtraNote")}</p>}
              {leftOver.map((l) => {
                const money = (n: number) => formatAmount(n, l.currency);
                const planned = goals.filter((g) => g.currency === l.currency).reduce((s, g) => s + (g.monthly ?? 0), 0) + extraMonthly;
                const left = l.amount - costMonthly;
                if (!whatIf && planned === 0) return null;
                return (
                  <p key={l.currency} className={cn(planned > left ? "text-danger" : "text-ink")}>
                    {costMonthly > 0 && `${t("goals.whatIfLeft", { left: money(left), usual: money(l.amount) })} `}
                    {planned > left
                      ? t("goals.whatIfTooMuch", { planned: money(planned), left: money(left) })
                      : t("goals.whatIfFits", { planned: money(planned), left: money(left) })}
                  </p>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default GoalsBoard;
