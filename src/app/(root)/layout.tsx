import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex h-screen w-full font-inter">
      SIDEBAR
      {children}
    </main>
  );
}
