import { CircleHelp, Gem, Lock } from "lucide-react";
import Link from "next/link";

import { spendTypeLabel } from "@/constants";
import { REGULAR_CHOICES, type Check } from "@/lib/checks";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/regularText";
import { checksForOwner, FREE_CHECKS, loadChecksState } from "@/lib/server/checks";
import { currentPlan } from "@/lib/server/plan";
import { formatAmount, maskLabel } from "@/lib/utils";

import CheckCard, { type CheckOption } from "./checkCard";

/**
 * Home's "Is this right?": one question at a time, from what the statements
 * leave unsure. Three answers are free; subscribers answer as many as they
 * like. Someone who has used their three sees how many are waiting, no more.
 */
const ChecksPanel = async ({
  ownerId,
  person,
  showEmpty = false,
}: {
  ownerId: string;
  person: { firstName?: string; lastName?: string };
  showEmpty?: boolean;
}) => {
  const [checks, state, plan] = await Promise.all([checksForOwner(ownerId, person).catch(() => [] as Check[]), loadChecksState(ownerId), currentPlan()]);
  if (checks.length === 0) {
    if (!showEmpty) return null;
    const t = await getT();
    return <p className="panel panel-body text-14 text-ink-muted">{t("home.checksNone")}</p>;
  }
  const left = plan?.kind === "subscribed" ? null : Math.max(0, FREE_CHECKS - state.used);
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  if (left === 0) {
    return (
      <section className="panel" aria-labelledby="checks-title">
        <header className="panel-head">
          <h2 id="checks-title" className="eyebrow flex items-center gap-2">
            <CircleHelp className="size-3.5" aria-hidden /> {t("home.checksTitle")}
          </h2>
          <Lock className="size-3.5 text-ink-muted" aria-hidden />
        </header>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-14 text-ink-muted">{t("home.checksLocked", { count: checks.length })}</p>
          <Link href="/plans" className="btn-primary w-fit">
            <Gem className="size-4" aria-hidden /> {t("home.checksSeePlans")}
          </Link>
        </div>
      </section>
    );
  }

  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const { question, options } = wordsFor(checks[0], t, day);

  return (
    <section className="panel" aria-labelledby="checks-title">
      <header className="panel-head">
        <h2 id="checks-title" className="eyebrow flex items-center gap-2">
          <CircleHelp className="size-3.5" aria-hidden /> {t("home.checksTitle")}
        </h2>
        {left !== null && <span className="eyebrow">{t("home.checksFreeLeft", { count: left })}</span>}
      </header>
      <div className="panel-body flex flex-col gap-3">
        <p className="text-13 text-ink-muted">{t("home.checksIntro")}</p>
        <CheckCard key={checks[0].key} id={checks[0].key} question={question} options={options} />
        {checks.length > 1 && <p className="text-12 text-ink-muted">{t("home.checksMore", { count: checks.length - 1 })}</p>}
      </div>
    </section>
  );
};

/** The question in words, and its answers, for one check. */
function wordsFor(check: Check, t: Translate, day: (d: string) => string): { question: string; options: CheckOption[] } {
  const yesNo: CheckOption[] = [
    { value: "yes", label: t("home.answerYes"), tone: "primary" },
    { value: "no", label: t("home.answerNo") },
    { value: "skip", label: t("home.answerSkip"), tone: "ghost" },
  ];
  const money = (n: number) => formatAmount(n, check.currency);
  switch (check.kind) {
    case "ownPair":
      return {
        question: t("home.qOwnPair", {
          date: day(check.date),
          amount: money(check.amount),
          from: `${check.from.name} ${maskLabel(check.from.mask)}`,
          to: `${check.to.name} ${maskLabel(check.to.mask)}`,
        }),
        options: yesNo,
      };
    case "ownCredit":
      return { question: t("home.qOwnCredit", { amount: money(check.amount), payee: check.payee, date: day(check.date) }), options: yesNo };
    case "salary":
      return { question: t("home.qSalary", { amount: money(check.monthly), payee: check.payee, count: check.months }), options: yesNo };
    case "salaryKind":
      return { question: t("home.qSalaryKind", { amount: money(check.monthly), payee: check.payee, count: check.months }), options: yesNo };
    case "regularKind":
      return {
        question: t("home.qRegular", { payee: check.payee, amount: money(check.amount), cadence: t(`home.cadence_${check.cadence}`), count: check.count }),
        options: [
          ...REGULAR_CHOICES.map((c) => ({ value: c, label: spendTypeLabel(t, c) })),
          { value: "skip", label: t("home.checksNotRegular"), tone: "ghost" as const },
        ],
      };
    case "plan":
      return {
        question: t("home.qPlan", { payee: check.payee, amount: money(check.amount), cadence: t(`home.cadence_${check.cadence}`) }),
        options: [
          ...check.guesses.map((g, i) => ({ value: g, label: g, tone: i === 0 ? ("primary" as const) : ("secondary" as const) })),
          { value: "notsub", label: t("home.qPlanNot") },
          { value: "skip", label: t("home.qPlanLater"), tone: "ghost" as const },
        ],
      };
  }
}

export default ChecksPanel;
