"use client";

import { Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { useT } from "@/components/i18nProvider";
import { saveGoal } from "@/lib/actions/goal.action";
import { MAX_NAME_LENGTH } from "@/lib/corrections";
import type { Goal } from "@/lib/goals";

const toNumber = (text: string) => (text.trim() === "" ? undefined : Number(text.replace(/,/g, "")));

/** Add a goal, or change one. Only the name and the target are needed. */
const GoalForm = ({ goal, currencies, thisMonth, onDone }: { goal?: Goal; currencies: string[]; thisMonth: string; onDone: () => void }) => {
  const t = useT();
  const ids = useId();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  const [saved, setSaved] = useState(goal?.saved ? String(goal.saved) : "");
  const [monthly, setMonthly] = useState(goal?.monthly ? String(goal.monthly) : "");
  const [by, setBy] = useState(goal?.by ?? "");
  const [currency, setCurrency] = useState(goal?.currency ?? currencies[0] ?? "INR");
  // Pending until the page drawn by the action (with the new goal) is on screen.
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveGoal({
          ...(goal ? { id: goal.id } : {}),
          name,
          target: toNumber(target) ?? 0,
          saved: toNumber(saved),
          monthly: toNumber(monthly),
          by: by || undefined,
          currency,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone();
      } catch {
        setError(t("common.notReachable"));
      }
    });
  };

  const field = (id: string, label: string, hint: string | null, input: React.ReactNode) => (
    <div className="field">
      <label className="field-label" htmlFor={`${ids}-${id}`}>
        {label}
      </label>
      {input}
      {hint && (
        <p id={`${ids}-${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {field(
        "name",
        t("goals.fieldName"),
        t("goals.fieldNameHint"),
        <input
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          required
          className="field-input"
          aria-describedby={`${ids}-name-hint`}
        />,
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "target",
          t("goals.fieldTarget"),
          null,
          <input id={`${ids}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required className="field-input" />,
        )}
        {field(
          "saved",
          t("goals.fieldSaved"),
          t("goals.fieldSavedHint"),
          <input
            id={`${ids}-saved`}
            inputMode="decimal"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
            className="field-input"
            aria-describedby={`${ids}-saved-hint`}
          />,
        )}
        {field(
          "monthly",
          t("goals.fieldMonthly"),
          t("goals.fieldMonthlyHint"),
          <input
            id={`${ids}-monthly`}
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="field-input"
            aria-describedby={`${ids}-monthly-hint`}
          />,
        )}
        {field(
          "by",
          t("goals.fieldBy"),
          t("goals.fieldByHint"),
          <input
            id={`${ids}-by`}
            type="month"
            min={thisMonth}
            value={by}
            onChange={(e) => setBy(e.target.value)}
            className="field-input"
            aria-describedby={`${ids}-by-hint`}
          />,
        )}
      </div>
      {currencies.length > 1 &&
        field(
          "currency",
          t("goals.fieldCurrency"),
          null,
          <select id={`${ids}-currency`} value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>,
        )}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {busy ? t("goals.saving") : goal ? t("goals.saveChanges") : t("goals.add")}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
};

export default GoalForm;
