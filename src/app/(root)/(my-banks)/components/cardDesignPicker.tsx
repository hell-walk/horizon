"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { useT } from "@/components/i18nProvider";
import { setCardDesign } from "@/lib/actions/card.action";
import { cardBackground, designChoices } from "@/lib/cardDesigns";
import { cn } from "@/lib/utils";

/**
 * Swatches for the selected account's card: Auto (its bank's colours when
 * known), the bank skin itself, Classic black and the unbranded themes. The
 * card updates at once; the choice is saved to the account.
 */
const CardDesignPicker = ({ account, onPick }: { account: Account; onPick: (design: string) => void }) => {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = account.cardDesign || "auto";

  const pick = (id: string) => {
    if (id === current) return;
    const previous = current;
    onPick(id); // optimistic
    setError(null);
    startTransition(async () => {
      const result = await setCardDesign({ appwriteItemId: account.appwriteItemId, design: id });
      if (!result.ok) {
        onPick(previous);
        setError(result.error);
      }
    });
  };

  // Bank skins keep the bank's own name; Auto and the themes are translated.
  const nameOf = ({ id, label, design }: ReturnType<typeof designChoices>[number]) => {
    if (id === "auto") return design.kind === "bank" ? t("banks.designAutoBank", { bank: design.label }) : t("banks.designAuto");
    const key = `banks.design_${id}`;
    const text = t(key);
    return text === key ? label : text;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{t("banks.cardDesign")}</span>
        {pending && <Loader2 className="size-3.5 animate-spin text-ink-faint" />}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("banks.cardDesign")}>
        {designChoices(account).map((choice) => {
          const { id, design } = choice;
          const label = nameOf(choice);
          const active = id === current;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => pick(id)}
              className={cn(
                "relative h-9 w-14 overflow-hidden rounded-md ring-offset-2 ring-offset-card transition",
                active ? "ring-2 ring-lime" : "ring-1 ring-line hover:ring-ink-faint"
              )}
              style={{ background: cardBackground(design) }}
            >
              {id === "auto" && <span className="absolute inset-x-0 bottom-0 bg-black/50 py-px text-center font-mono text-[11px] uppercase text-white">{t("banks.designAuto")}</span>}
              {active && id !== "auto" && <Check className="absolute right-1 top-1 size-3 text-white" />}
            </button>
          );
        })}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

export default CardDesignPicker;
