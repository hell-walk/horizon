"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { logoutAccount } from "@/lib/actions/user.action";

// Signed-in user block at the bottom of the sidebar and the mobile sheet.
const Footer = ({ user, type = "desktop" }: FooterProps) => {
  const router = useRouter();
  const mobile = type === "mobile";

  const handleLogOut = async () => {
    const loggedOut = await logoutAccount();
    if (loggedOut) router.push("/sign-in");
  };

  const initial = user?.firstName?.[0] ?? user?.name?.[0] ?? "?";

  return (
    <footer className="flex items-center gap-3 border-t border-line py-4 sm:px-1">
      <div className="flex-center size-9 shrink-0 rounded-sm bg-primary font-display text-14 font-bold text-primary-foreground">
        {initial}
      </div>

      <div className={mobile ? "flex min-w-0 flex-1 flex-col" : "flex min-w-0 flex-1 flex-col max-xl:hidden"}>
        <p className="truncate text-14 font-semibold text-ink">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="truncate text-12 text-ink-faint">{user?.email}</p>
      </div>

      <div className={mobile ? "flex items-center gap-1" : "flex items-center gap-1 max-xl:hidden"}>
        <button
          type="button"
          onClick={handleLogOut}
          aria-label="Log out"
          className="flex-center size-9 rounded-md border border-line bg-card text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </footer>
  );
};

export default Footer;
