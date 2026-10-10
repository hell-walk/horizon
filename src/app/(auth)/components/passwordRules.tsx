"use client";

import { Check, Circle } from "lucide-react";

import { useT } from "@/components/i18nProvider";
import { checkPassword } from "@/lib/passwordRules";
import { cn } from "@/lib/utils";

/** The password rules as a checklist that ticks itself while the person types. */
const PasswordRules = ({ password, email, id }: { password: string; email: string; id?: string }) => {
  const t = useT();
  const check = checkPassword(password, email);
  const rules: [boolean, string][] = [
    [check.length, t("auth.ruleLength")],
    [check.notCommon, t("auth.ruleNotCommon")],
    [check.noEmail, t("auth.ruleNoEmail")],
  ];
  return (
    <div id={id} className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-low p-3">
      <p className="eyebrow">{t("auth.rulesTitle")}</p>
      <ul className="flex flex-col gap-1 text-13">
        {rules.map(([ok, text]) => (
          <li key={text} className={cn("flex items-center gap-2", ok ? "text-success" : "text-ink-muted")}>
            {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
            <span>
              {text}
              <span className="sr-only">{ok ? ` (${t("auth.ruleMet")})` : ` (${t("auth.ruleNotMet")})`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-12 text-ink-muted">{t("auth.ruleTip")}</p>
    </div>
  );
};

export default PasswordRules;
