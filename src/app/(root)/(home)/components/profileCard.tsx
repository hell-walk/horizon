import { getT } from "@/lib/i18n/server";

/** Who is signed in, and where their plan stands (how many days are left). Above the cards on every screen size. */
const ProfileCard = async ({ user, planLine }: { user: User; planLine: string }) => {
  const t = await getT();
  return (
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
          {planLine && <p className="eyebrow mt-1">{planLine}</p>}
        </div>
      </div>
    </section>
  );
};

export default ProfileCard;
