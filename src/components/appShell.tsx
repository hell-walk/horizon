"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import Sidebar from "./sidebar";
import Topbar from "./topbar";

/* The sidebar can be collapsed; the choice lives in localStorage. While it is
   collapsed the floating pill navbar takes over in the top bar. */
const KEY = "horizon:sidebar-collapsed";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const setSidebarCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the change still applies for this page.
  }
  listeners.forEach((cb) => cb());
};

export const useSidebarCollapsed = () => useSyncExternalStore(subscribe, read, () => false);

const AppShell = ({
  user,
  bankCount,
  providerCounts,
  children,
}: {
  user: User;
  bankCount: number;
  providerCounts: Record<string, number>;
  children: ReactNode;
}) => {
  const collapsed = useSidebarCollapsed();

  return (
    <main className="flex h-screen w-full overflow-hidden">
      {!collapsed && <Sidebar user={user} providerCounts={providerCounts} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar user={user} bankCount={bankCount} collapsed={collapsed} onToggle={() => setSidebarCollapsed(!collapsed)} />
        {children}
      </div>
    </main>
  );
};

export default AppShell;
