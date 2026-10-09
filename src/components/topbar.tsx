import Logo from "./logo";
import MobileNav from "./mobileNav";
import ThemeSwitch from "./themeSwitch";

// Thin bar above every signed-in page. On phones it carries the logo and the
// menu; on larger screens it shows the session summary. The theme slider
// lives here on every size.
const Topbar = ({ user, bankCount }: { user: User; bankCount: number }) => (
  <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-low px-4 sm:px-6 lg:px-8">
    <div className="md:hidden">
      <Logo />
    </div>

    <div className="hidden items-center gap-3 md:flex">
      <span className="chip">
        <span className="dot bg-lime" />
        Synced
      </span>
      <span className="eyebrow">
        {bankCount} {bankCount === 1 ? "account" : "accounts"} linked
      </span>
    </div>

    <div className="flex items-center gap-3">
      <span className="hidden text-12 text-ink-muted lg:block">{user.email}</span>
      <ThemeSwitch className="max-md:hidden" />
      <ThemeSwitch compact className="md:hidden" />
      <div className="md:hidden">
        <MobileNav user={user} />
      </div>
    </div>
  </header>
);

export default Topbar;
