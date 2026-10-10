import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { CONTACT_EMAIL } from "@/lib/site";

// Footer for the public pages: legal links and the copyright line.
const SiteFooter = async () => {
  const t = await getT();

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-line px-6 py-4 font-mono text-[12px] uppercase tracking-wider text-ink-faint">
      <span translate="no">&copy; {new Date().getFullYear()} Horizon</span>
      <Link href="/privacy" className="hover:text-ink">
        {t("common.footerPrivacy")}
      </Link>
      <Link href="/terms" className="hover:text-ink">
        {t("common.footerTerms")}
      </Link>
      <Link href="/pricing" className="hover:text-ink">
        {t("common.footerPricing")}
      </Link>
      <Link href="/refunds" className="hover:text-ink">
        {t("common.footerRefunds")}
      </Link>
      <Link href="/contact" className="hover:text-ink">
        {t("common.footerContact")}
      </Link>
      <a href={`mailto:${CONTACT_EMAIL}`} translate="no" className="hover:text-ink">
        {CONTACT_EMAIL}
      </a>
    </footer>
  );
};

export default SiteFooter;
