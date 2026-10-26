import Link from "next/link";

import { getT } from "@/lib/i18n/server";

// Shown in place of a page when the records store (Appwrite) is not answering:
// paused, down, or misconfigured.
export default async function DataUnavailable() {
  const t = await getT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-24 font-semibold">{t("common.dataUnavailableTitle")}</h1>
      <p className="max-w-md text-14 text-gray-600 dark:text-gray-300">{t("common.dataUnavailableBody")}</p>
      <Link href="/" className="mt-2 rounded-lg border px-4 py-2 text-14 font-medium">
        {t("common.dataUnavailableRetry")}
      </Link>
    </main>
  );
}
