import type { Metadata } from "next";
import Link from "next/link";

import Logo from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("common.notFoundTitle") };
}

export default async function NotFound() {
  const t = await getT();

  return (
    <main id="main" tabIndex={-1} className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-6 text-center outline-none">
      <Logo compact />
      <p className="eyebrow">{t("common.notFoundEyebrow")}</p>
      <h1 className="h-display">{t("common.notFoundTitle")}</h1>
      <p className="max-w-md text-14 text-ink-muted">{t("common.notFoundBody")}</p>
      <Link href="/" className="btn-primary">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
