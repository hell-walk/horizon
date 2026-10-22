import { CircleHelp } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import type { Check } from "@/lib/checks";
import { getT } from "@/lib/i18n/server";
import { checksForOwner } from "@/lib/server/checks";

import ChecksBarClose, { CHECKS_SEEN_COOKIE } from "./checksBarClose";

/**
 * One line under the top bar when some payments are unclear ("Is this right?"):
 * how many, why it matters, and the way to the questions. Closing it hides it
 * for the day (a cookie); it comes back when there is still something to check.
 */
const ChecksBar = async ({ ownerId, person }: { ownerId: string; person: { firstName?: string; lastName?: string } }) => {
  const today = new Date().toISOString().slice(0, 10);
  if ((await cookies()).get(CHECKS_SEEN_COOKIE)?.value === today) return null;
  const checks = await checksForOwner(ownerId, person).catch(() => [] as Check[]);
  if (checks.length === 0) return null;
  const t = await getT();

  return (
    <ChecksBarClose today={today}>
      <div role="status" className="flex items-center gap-3 border-b border-warn/40 bg-warn-soft py-1.5 pl-4 pr-10 text-13 text-warn-ink sm:pl-6 sm:pr-12">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{t("home.checksBarText", { count: checks.length })}</span>
        <Link href="/checks" className="shrink-0 font-semibold text-ink underline underline-offset-4">
          {t("home.checksBarReview")}
        </Link>
      </div>
    </ChecksBarClose>
  );
};

export default ChecksBar;
