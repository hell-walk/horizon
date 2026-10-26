import Image from "next/image";

import { cn } from "@/lib/utils";

// A real screenshot of the app (scripts/capture-landing-shots.mjs makes them,
// light and dark, in public/landing). Both versions are in the page; the one
// for the other theme is display:none and, being lazy, is never fetched.
// `tilt` and `drift` feed the scroll-driven motion in globals.css.

export type ShotName = "home" | "history" | "bills" | "goals" | "connect" | "charges" | "loans" | "calendar" | "report" | "spending" | "checks" | "home-phone" | "subscriptions";

type Props = {
  name: ShotName;
  alt: string;
  /** Above the fold: fetched at once (the light one) instead of lazily. */
  priority?: boolean;
  /** Fraction of the viewport the picture takes on wide screens, for the right file size. */
  sizes?: string;
  tilt?: number;
  drift?: "slow" | "normal" | "fast";
  className?: string;
};

const SIZE = { phone: [390, 844], desktop: [1280, 820] } as const;

export default function Shot({ name, alt, priority = false, sizes = "(min-width: 1280px) 50vw, 100vw", tilt = 0, drift, className }: Props) {
  const [width, height] = name === "home-phone" ? SIZE.phone : SIZE.desktop;
  const picture = (theme: "light" | "dark") => (
    <Image
      src={`/landing/${name}-${theme}.png`}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority && theme === "light"}
      fetchPriority={priority && theme === "light" ? "high" : undefined}
      loading={priority && theme === "light" ? "eager" : "lazy"}
      className={cn("h-auto w-full", theme === "light" ? "dark:hidden" : "hidden dark:block")}
    />
  );
  return (
    <figure
      className={cn("overflow-hidden rounded-lg border border-line bg-surface-low shadow-lift", drift && `landing-drift-${drift}`, className)}
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      {picture("light")}
      {picture("dark")}
    </figure>
  );
}
