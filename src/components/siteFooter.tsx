import Link from "next/link";

// Footer for the public pages: legal links and the copyright line.
const SiteFooter = () => (
  <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-line px-6 py-4 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
    <span>&copy; {new Date().getFullYear()} Horizon</span>
    <Link href="/privacy" className="hover:text-ink">
      Privacy
    </Link>
    <Link href="/terms" className="hover:text-ink">
      Terms
    </Link>
    <a href="mailto:support@horizon.app" className="hover:text-ink">
      support@horizon.app
    </a>
  </footer>
);

export default SiteFooter;
