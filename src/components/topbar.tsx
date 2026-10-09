import Logo from "./logo";
import Navbar from "./navbar";
import ThemeSwitch from "./themeSwitch";
import UserMenu from "./userMenu";

// The only chrome above a signed-in page: wordmark, the floating pill
// navigation (tablet and up), the theme slider and the account menu. Phones
// navigate with the bottom bar instead.
const Topbar = ({ user, bankCount }: { user: User; bankCount: number }) => (
  <header className="grid h-16 shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-line bg-surface-low px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <Logo className="max-md:hidden max-xl:hidden" />
      <Logo compact className="md:max-xl:flex hidden" />
      <Logo className="md:hidden" />
      <span className="chip max-xl:hidden">
        <span className="dot bg-lime" />
        {bankCount} {bankCount === 1 ? "account" : "accounts"}
      </span>
    </div>

    <div className="hidden justify-center md:flex">
      <Navbar />
    </div>

    <div className="flex items-center justify-end gap-3">
      <ThemeSwitch className="max-md:hidden" />
      <UserMenu user={user} />
    </div>
  </header>
);

export default Topbar;
