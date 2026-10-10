"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/i18nProvider";
import { deleteBank } from "@/lib/actions/privacy.action";

type BankRow = { id: string; name: string; mask: string };

/** One row per bank; removing asks once more, naming the bank. */
const RemoveBanks = ({ banks }: { banks: BankRow[] }) => {
  const t = useT();
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const label = (b: BankRow) => (b.mask ? `${b.name} ••${b.mask}` : b.name);

  const remove = async (bank: BankRow) => {
    setBusy(bank.id);
    setMessage(null);
    try {
      const result = await deleteBank({ appwriteItemId: bank.id });
      setMessage(result.ok ? { ok: true, text: t("data.removeDone", { bank: label(bank) }) } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: t("common.notReachable") });
    } finally {
      setBusy(null);
      setAsking(null);
    }
  };

  return (
    <section className="panel" aria-labelledby="banks-title">
      <div className="panel-body flex flex-col gap-3">
        <h2 id="banks-title" className="font-display text-18 font-semibold text-ink">
          {t("data.banksTitle")}
        </h2>
        <p className="text-14 text-ink-muted">{t("data.banksBody")}</p>
        {banks.length === 0 ? (
          <p className="text-14 text-ink-muted">{t("data.banksEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {banks.map((bank) => (
              <li key={bank.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-14 font-semibold text-ink" translate="no">
                  {label(bank)}
                </span>
                {asking === bank.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-13 text-ink" id={`ask-${bank.id}`}>
                      {t("data.removeConfirm", { bank: label(bank) })}
                    </span>
                    <button type="button" autoFocus onClick={() => remove(bank)} disabled={busy !== null} className="btn-primary btn-sm" aria-describedby={`ask-${bank.id}`}>
                      {busy === bank.id && <Loader2 className="size-3.5 animate-spin" />} {t("data.removeYes")}
                    </button>
                    <button type="button" onClick={() => setAsking(null)} disabled={busy !== null} className="btn-ghost btn-sm">
                      {t("data.removeNo")}
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setAsking(bank.id)} disabled={busy !== null} className="btn-secondary btn-sm">
                    <Trash2 className="size-3.5" /> {t("data.removeButton")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-13 text-success" : "field-error"}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
};

export default RemoveBanks;
