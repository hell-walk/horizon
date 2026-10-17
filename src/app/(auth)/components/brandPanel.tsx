import { CountUp, RollingDigits } from "./liveNumber";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// The black brand panel from the sign-in page: the promise, an example card
// with live numbers, and three facts. Also fills the empty side of pages that
// are a single form (feedback). Always black on white, whatever the theme.
export default async function BrandPanel({ className }: { className?: string }) {
  const t = await getT();
  // [label, value, value is data (currency codes are never translated)]
  const facts: [string, string, boolean][] = [
    [t("auth.factConnect"), t("auth.factConnectValue"), false],
    [t("auth.factCurrencies"), "USD · INR", true],
    [t("auth.factData"), t("auth.factDataValue"), false],
  ];

  return (
    <aside className={cn("relative flex flex-col justify-between gap-10 overflow-hidden bg-black p-10 text-white", className)}>
      <span className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-white/10" />
      <span className="pointer-events-none absolute -right-36 -top-36 size-96 rounded-full border border-white/10" />

      <div className="flex flex-col gap-6">
        <p className="eyebrow text-lime">{t("auth.brandEyebrow")}</p>
        <h2 className="font-display text-40 font-semibold tracking-tight">
          {t("auth.brandTitleLine1")}
          <br />
          {t("auth.brandTitleLine2")}
        </h2>
        <p className="max-w-sm text-14 text-white/70">{t("auth.brandBody")}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-white/15 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-14 font-bold uppercase tracking-tight">Horizon</span>
          <span className="chip border-lime bg-lime text-lime-foreground">{t("auth.cardExample")}</span>
        </div>
        <p className="amount text-20" translate="no">
          <span className="opacity-50">•••• •••• ••••</span> <RollingDigits value="4091" />
        </p>
        <div className="flex items-end justify-between">
          <span className="flex flex-col">
            <span className="eyebrow text-white/60">{t("auth.cardHolder")}</span>
            <span className="font-mono text-12 uppercase">{t("auth.cardYourName")}</span>
          </span>
          <span className="flex flex-col items-end">
            <span className="eyebrow text-white/60">{t("auth.cardBalance")}</span>
            <span className="amount text-14 font-semibold" translate="no">
              <CountUp value={124560.5} prefix="₹" />
            </span>
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
        {facts.map(([label, value, isData]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="eyebrow text-white/60">{label}</dt>
            <dd className="font-mono text-12" translate={isData ? "no" : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
