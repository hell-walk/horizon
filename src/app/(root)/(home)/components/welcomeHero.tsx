import { FileUp, Lock, PlugZap } from "lucide-react";
import Link from "next/link";

import Shot from "@/components/shot";
import { getT } from "@/lib/i18n/server";

/**
 * The landing page's top, inside Home's connected-banks box: the name, the line,
 * and the two things to do next (connect a bank, upload a statement) in place
 * of the sign-up buttons; the app's screens beneath. Says what Horizon is and
 * what to do, to someone who has just arrived.
 */
const WelcomeHero = async () => {
  const t = await getT();
  return (
    <section className="relative overflow-hidden border-b border-line px-4 pb-6 pt-8 sm:px-6" aria-label={t("landing.tagline")}>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="chip h-auto max-w-full whitespace-normal py-1 text-center">
          <span className="dot bg-lime shrink-0" />
          {t("landing.heroEyebrow")}
        </p>
        <p className="font-display text-[clamp(44px,9vw,96px)] font-bold uppercase leading-[0.9] tracking-tighter text-ink">Horizon</p>
        <p className="font-display text-20 font-semibold tracking-tight sm:text-24">{t("landing.tagline")}</p>
        <p className="max-w-xl text-14 text-ink-muted">{t("landing.heroBody")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/connect-bank" className="btn-accent">
            <PlugZap className="size-4" aria-hidden /> {t("nav.connect")}
          </Link>
          <Link href="/upload-statement" className="btn-secondary">
            <FileUp className="size-4" aria-hidden /> {t("home.actionUpload")}
          </Link>
        </div>
        <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-ink-faint">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          {t("landing.trust")}
        </p>
      </div>

      {/* Three screens on wide screens, the phone on narrow ones. */}
      <div className="relative mx-auto mt-8 hidden max-w-4xl items-end gap-4 md:grid md:grid-cols-[1fr_1.5fr_1fr]">
        <Shot name="history" alt={t("landing.shotHistory")} sizes="(min-width: 1280px) 22vw, 28vw" tilt={-3} className="translate-y-6" />
        <Shot name="home" alt={t("landing.shotHome")} sizes="(min-width: 1280px) 34vw, 42vw" />
        <Shot name="goals" alt={t("landing.shotGoals")} sizes="(min-width: 1280px) 22vw, 28vw" tilt={3} className="translate-y-6" />
      </div>
      <div className="mx-auto mt-6 max-w-[260px] md:hidden">
        <Shot name="home-phone" alt={t("landing.shotPhone")} sizes="260px" className="rounded-[28px]" />
      </div>
    </section>
  );
};

export default WelcomeHero;
