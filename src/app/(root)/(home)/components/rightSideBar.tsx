import { PlugZap } from "lucide-react";
import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";
import { getT } from "@/lib/i18n/server";

import BankInfo from "./BankInfo";
import CardStack from "@/components/cardStack";
import Copy from "@/components/Copy";

// Right column on Home. Pinned while the main column scrolls: it holds the
// card deck, the profile and the account switcher, which are all actionable.
const RightSideBar = async ({ user, banks, selected, spending }: RightSidebarProps) => {
  const t = await getT();
  const current = banks.find((b) => b.appwriteItemId === selected) ?? banks[0];

  return (
    <aside className="no-scrollbar flex w-full flex-col gap-4 xl:sticky xl:top-0 xl:max-h-[calc(100vh-4rem-3.5rem)] xl:w-[340px] xl:shrink-0 xl:overflow-y-auto">
      {banks.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardStack accounts={banks} selected={current?.appwriteItemId} userName={`${user.firstName} ${user.lastName}`} mode="url" />
          {current && <Copy title={current.sharableId} />}
        </section>
      )}

      {spending}

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">{t("home.profile")}</span>
          <span className="chip-lime">{t("common.verified")}</span>
        </header>
        <div className="panel-body flex items-center gap-4">
          <div translate="no" className="flex-center size-12 shrink-0 rounded-sm bg-primary font-display text-18 font-bold text-primary-foreground">
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </div>
          <div className="flex min-w-0 flex-col">
            <p translate="no" className="truncate text-16 font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p translate="no" className="truncate text-12 text-ink-muted">
              {user.email}
            </p>
            {user.city && (
              <p translate="no" className="eyebrow mt-1">
                {user.city}
                {user.state ? `, ${user.state}` : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">{t("home.linkedAccounts")}</span>
          <span className="eyebrow text-ink">{banks.length}</span>
        </header>
        <div className="panel-body flex flex-col gap-2">
          {banks.map((bank) => (
            <BankInfo key={bank.appwriteItemId} account={bank} appwriteItemId={current?.appwriteItemId} type="card" />
          ))}
          {banks.length === 0 && <p className="text-14 text-ink-muted">{t("home.noLinkedAccounts")}</p>}

          <Link href="/connect-bank" className="btn-secondary mt-2 w-full">
            <PlugZap className="size-4" /> {t("home.connectAnother")}
          </Link>

          <p className="eyebrow mt-1 text-center">
            {Object.values(PROVIDER_LABELS)
              .map((p) => t(p.nameKey))
              .join(" · ")}
          </p>
        </div>
      </section>
    </aside>
  );
};

export default RightSideBar;
