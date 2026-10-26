"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Light/dark follows the OS until the user picks one; the choice is kept in
// localStorage. Transitions stay enabled during the flip so the theme switch
// can animate; the page itself has no colour transitions, so it still snaps.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
