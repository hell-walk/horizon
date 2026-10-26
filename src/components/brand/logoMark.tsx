import { cn } from "@/lib/utils";

/** The diamond mark on its dark square: the logo without the word. Plain markup, so client and server components alike can show it. */
const LogoMark = ({ className }: { className?: string }) => (
  <span className={cn("flex-center size-8 shrink-0 rounded-sm bg-primary text-lime", className)} aria-hidden>
    <svg viewBox="0 0 24 24" className="size-1/2" fill="currentColor" aria-hidden="true">
      <path d="M12 2 22 12 12 22 2 12Z" />
    </svg>
  </span>
);

export default LogoMark;
