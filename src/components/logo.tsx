import Link from "next/link";

import { cn } from "@/lib/utils";

// Wordmark with the diamond mark. `compact` shows the mark only (narrow sidebar).
const Logo = ({ compact = false, className, href = "/" }: { compact?: boolean; className?: string; href?: string }) => (
  <Link href={href} aria-label="Horizon home" className={cn("flex items-center gap-2.5", className)}>
    <span className="flex-center size-8 shrink-0 rounded-sm bg-primary text-lime">
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2 22 12 12 22 2 12Z" />
      </svg>
    </span>
    {!compact && (
      <span className="flex flex-col leading-none">
        <span className="whitespace-nowrap font-display text-18 font-bold uppercase tracking-tight text-ink">
          Horizon <span className="text-ink-faint">{"// 01"}</span>
        </span>
        <span className="eyebrow mt-1 whitespace-nowrap text-[11px]">Multi-currency ledger</span>
      </span>
    )}
  </Link>
);

export default Logo;
