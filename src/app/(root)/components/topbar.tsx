import Logo from "@/components/logo";
import { getT } from "@/lib/i18n/server";
import Navbar from "./navbar";
import ThemeSwitch from "@/components/themeSwitch";
import UserMenu from "./userMenu";

// The only chrome above a signed-in page: wordmark, the floating pill
// navigation (tablet and up), the theme slider (every screen size) and the account menu. Phones
// navigate with the bottom bar instead.
const Topbar = async ({ user, bankCount }: { user: User; bankCount: number }) => {
  const t = await getT();

  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-line bg-surface-low px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Logo className="max-md:hidden max-xl:hidden" />
        <Logo compact className="md:max-xl:flex hidden" />
        <Logo className="md:hidden max-[400px]:hidden" />
        <Logo compact className="hidden max-[400px]:flex" />
        <span className="chip max-xl:hidden">
          <span className="dot bg-lime" />
          {t("nav.accountCount", { count: bankCount })}
        </span>
      </div>

      <div className="hidden justify-center md:flex">
        <Navbar />
      </div>

      <div className="flex items-center justify-end gap-3">
        <ThemeSwitch />
        <UserMenu user={user} />
      </div>
    </header>
  );
};

export default Topbar;
