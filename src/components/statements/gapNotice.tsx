"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

import { askAboutGapsAgain } from "@/lib/actions/statement.action";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Gap } from "@/lib/statements/gaps";

import { useLocale, useT } from "../providers/i18nProvider";

/** A date as the reader writes it ("3 Nov 2026"). */
const useDay = () => {
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (date: string) => format.format(new Date(`${date}T00:00:00Z`));
};

/**
 * Weeks missing between this statement and the entries already saved for the
 * account. When the person wants to be asked: what is missing, why it matters,
 * and two ticks ("save anyway", "don't ask me again") that the Save button
 * waits for. When they said not to ask: the same facts as a note, and a way to
 * be asked again.
 */
const GapNotice = ({
  gap,
  ask,
  saveAnyway,
  onSaveAnyway,
  never,
  onNever,
}: {
  gap: Gap;
  ask: boolean;
  saveAnyway: boolean;
  onSaveAnyway: (on: boolean) => void;
  never: boolean;
  onNever: (on: boolean) => void;
}) => {
  const t = useT();
  const day = useDay();
  const [asking, setAsking] = useState<"idle" | "working" | "done">("idle");
  const what =
    gap.reason === "balance"
      ? t("connect.gapBalance", { from: day(gap.from), to: day(gap.to) })
      : t("connect.gapDates", { from: day(gap.from), to: day(gap.to), count: gap.days });

  if (!ask) {
    return (
      <div className="flex flex-col gap-1.5 border-t border-line bg-warn/10 px-3 py-2 text-13 text-ink">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden /> {what} {t("connect.gapRisk")}
        </p>
        {asking === "done" ? (
          <p role="status" className="pl-6 text-ink-muted">
            {t("connect.gapAskAgainDone")}
          </p>
        ) : (
          <button
            type="button"
            className="w-fit pl-6 text-left font-semibold underline underline-offset-2"
            disabled={asking === "working"}
            onClick={async () => {
              setAsking("working");
              const result = await askAboutGapsAgain().catch(() => ({ ok: false }));
              setAsking(result.ok ? "done" : "idle");
            }}
          >
            {asking === "working" && <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden />}
            {t("connect.gapAskAgain")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-2 border-t border-warn/40 bg-warn/10 px-3 py-3 text-13 text-ink">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4 shrink-0 text-warn-ink" aria-hidden /> {t("connect.gapTitle")}
      </p>
      <p>{what}</p>
      <p>{t("connect.gapRisk")}</p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="gapOk"
          value="1"
          checked={saveAnyway || never}
          onChange={(e) => onSaveAnyway(e.target.checked)}
          className="mt-0.5 size-4"
        />
        {t("connect.gapSaveAnyway")}
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="gapNever" value="1" checked={never} onChange={(e) => onNever(e.target.checked)} className="mt-0.5 size-4" />
        {t("connect.gapNever")}
      </label>
    </div>
  );
};

export default GapNotice;
