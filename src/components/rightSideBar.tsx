import { PlugZap } from "lucide-react";
import Link from "next/link";

import { PROVIDER_LABELS } from "@/constants";

import BankCard from "./bankCard";
import BankInfo from "./BankInfo";

// Right column on Home: the selected account's card, the profile, and every linked account.
const RightSideBar = ({ user, banks, selected }: RightSidebarProps) => {
  const card = banks.find((b) => b.appwriteItemId === selected) ?? banks[0];

  return (
    <aside className="flex w-full flex-col gap-4 xl:w-[340px] xl:shrink-0">
      {card && <BankCard account={card} userName={`${user.firstName} ${user.lastName}`} />}

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">Profile</span>
          <span className="chip-lime">Verified</span>
        </header>
        <div className="panel-body flex items-center gap-4">
          <div className="flex-center size-12 shrink-0 rounded-sm bg-primary font-display text-18 font-bold text-primary-foreground">
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-16 font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-12 text-ink-muted">{user.email}</p>
            {user.city && (
              <p className="eyebrow mt-1">
                {user.city}
                {user.state ? `, ${user.state}` : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <span className="eyebrow">Linked accounts</span>
          <span className="eyebrow text-ink">{String(banks.length).padStart(2, "0")}</span>
        </header>
        <div className="panel-body flex flex-col gap-2">
          {banks.map((bank) => (
            <BankInfo key={bank.appwriteItemId} account={bank} appwriteItemId={selected} type="card" />
          ))}
          {banks.length === 0 && <p className="text-14 text-ink-muted">No accounts linked yet.</p>}

          <Link href="/connect-bank" className="btn-secondary mt-2 w-full">
            <PlugZap className="size-4" /> Connect another bank
          </Link>

          <p className="eyebrow mt-1 text-center">
            {Object.values(PROVIDER_LABELS)
              .map((p) => p.name)
              .join(" · ")}
          </p>
        </div>
      </section>
    </aside>
  );
};

export default RightSideBar;
