import Image from "next/image";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// The top of the landing page as a picture (the name, the line, the three
// screens), for the empty side of single-form pages. Both themes are in the
// page; the one not shown is display:none and never fetched. Opens the
// landing page itself.
export default async function LandingHero({ className }: { className?: string }) {
  const t = await getT();
  const picture = (theme: "light" | "dark") => (
    <Image
      src={`/landing/hero-${theme}.png`}
      alt={t("landing.shotHero")}
      width={1600}
      height={1075}
      sizes="(min-width: 1280px) 40vw, 100vw"
      priority={theme === "light"}
      className={cn("h-auto w-full", theme === "light" ? "dark:hidden" : "hidden dark:block")}
    />
  );
  return (
    <Link href="/" className={cn("block overflow-hidden rounded-lg border border-line bg-surface-low shadow-lift transition-opacity hover:opacity-90", className)}>
      {picture("light")}
      {picture("dark")}
    </Link>
  );
}
