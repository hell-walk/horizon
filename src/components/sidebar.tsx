"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PROVIDER_LABELS, sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

import Footer from "./footer";
import Logo from "./logo";

const Sidebar = ({ user, providerCounts }: SidebarProps) => {
  const pathname = usePathname();

  return (
    <section className="sidebar">
      <nav className="flex flex-col gap-6">
        <div className="px-1">
          <Logo className="max-xl:hidden" />
          <Logo compact className="xl:hidden" />
        </div>

        <div className="flex flex-col gap-1">
          <p className="eyebrow mb-2 px-3 max-xl:hidden">Navigation</p>
          {sidebarLinks.map((item, index) => {
            const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.route}
                href={item.route}
                aria-current={isActive ? "page" : undefined}
                className={cn("sidebar-link", { "sidebar-link-active": isActive })}
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className="max-xl:hidden">{item.label}</span>
                </span>
                <span className="font-mono text-[10px] text-current opacity-50 max-xl:hidden">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Which providers have linked accounts. Hidden on the narrow sidebar. */}
        <div className="flex flex-col gap-1 max-xl:hidden">
          <p className="eyebrow mb-2 px-3">Connections</p>
          {Object.entries(PROVIDER_LABELS).map(([key, provider]) => {
            const count = providerCounts?.[key] ?? 0;
            return (
              <Link
                key={key}
                href="/connect-bank"
                className="flex items-center justify-between rounded-md border border-line bg-card px-3 py-2 text-12 transition-colors hover:bg-surface-container"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("dot", count > 0 ? "bg-lime" : "bg-line")} />
                  <span className="font-mono text-ink">{provider.name}</span>
                </span>
                <span className="eyebrow">{count > 0 ? `${count} linked` : provider.region}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Footer user={user} />
    </section>
  );
};

export default Sidebar;
