"use client";

import { Loader2, Pencil, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { useT } from "@/components/i18nProvider";
import {
  correctTransaction,
  undoCorrection,
} from "@/lib/actions/correction.action";
import { CATEGORIES, MAX_NAME_LENGTH } from "@/lib/corrections";
import { dataLabel } from "@/lib/i18n/labels";

type Props = {
  accountId: string;
  transactionId: string;
  /** What the row shows now (the user's name, or the cleaned bank text). */
  shownName: string;
  /** The bank's own text, shown so the user knows which entry this is. */
  bankText: string;
  /** The payee's own words, for "every entry from …"; null when the bank text has none. */
  payee: string | null;
  category: string;
  /** What the app would show without any change from the user. */
  autoName: string;
  autoCategory: string;
  changed: boolean;
};

/**
 * A small button on each entry that opens a form to give the entry a clearer
 * name or another category, for this entry or every entry from the same payee.
 */
const EditTransaction = ({
  accountId,
  transactionId,
  shownName,
  bankText,
  payee,
  category,
  autoName,
  autoCategory,
  changed,
}: Props) => {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const [name, setName] = useState(shownName);
  const [chosen, setChosen] = useState(category);
  const [everyPayment, setEveryPayment] = useState(payee !== null);
  const [busy, setBusy] = useState<"save" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setName(shownName);
    setChosen(category);
    setEveryPayment(payee !== null);
    setError(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const run = async (kind: "save" | "undo") => {
    setBusy(kind);
    setError(null);
    try {
      // Send the whole wanted state, measured against what the bank shows, so
      // changing only the category keeps a name chosen earlier.
      const wantName =
        name.trim() && name.trim() !== autoName ? name.trim() : undefined;
      const wantCategory = chosen !== autoCategory ? chosen : undefined;
      const result =
        kind === "save" && (wantName || wantCategory)
          ? await correctTransaction({
              accountId,
              transactionId,
              name: wantName,
              category: wantCategory,
              everyPayment,
            })
          : await undoCorrection({ accountId, transactionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The action revalidates the page, and its answer already carries the new list.
      close();
    } catch {
      setError(t("common.notReachable"));
    } finally {
      setBusy(null);
    }
  };

  const nothingChanged = name.trim() === shownName && chosen === category;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={t("history.editButtonFor", { name: shownName })}
        className="flex-center size-9 shrink-0 rounded-sm text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
      >
        <Pencil className="size-4" aria-hidden />
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${ids}-title`}
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-md border border-line bg-surface-low p-0 text-ink backdrop:bg-black/60"
      >
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run("save");
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2
              id={`${ids}-title`}
              className="font-display text-18 font-semibold"
            >
              {t("history.editTitle")}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("history.editClose")}
              className="flex-center size-9 rounded-sm hover:bg-surface-container"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <p className="text-13 text-ink-muted">
            {t("history.editBankText")}{" "}
            <span translate="no" className="break-all font-mono text-ink">
              {bankText}
            </span>
          </p>

          <div className="field">
            <label className="field-label" htmlFor={`${ids}-name`}>
              {t("history.editName")}
            </label>
            <input
              id={`${ids}-name`}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              aria-describedby={`${ids}-name-hint`}
              autoComplete="off"
            />
            <p id={`${ids}-name-hint`} className="field-hint">
              {t("history.editNameHint")}
            </p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`${ids}-category`}>
              {t("history.editCategory")}
            </label>
            <select
              id={`${ids}-category`}
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              className="field-input"
            >
              {!(CATEGORIES as readonly string[]).includes(category) && (
                <option value={category}>{dataLabel(t, category)}</option>
              )}
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {dataLabel(t, c)}
                </option>
              ))}
            </select>
            <p className="field-hint">{t("history.editCategoryHint")}</p>
          </div>

          {payee && (
            <label className="flex items-start gap-2 text-14">
              <input
                type="checkbox"
                checked={everyPayment}
                onChange={(e) => setEveryPayment(e.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                {t("history.editEveryPayment")}{" "}
                <strong translate="no">{payee}</strong>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={nothingChanged || busy !== null}
              className="btn-primary"
            >
              {busy === "save" && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {busy === "save"
                ? t("history.editSaving")
                : t("history.editSave")}
            </button>
            {changed && (
              <button
                type="button"
                onClick={() => run("undo")}
                disabled={busy !== null}
                className="btn-ghost"
              >
                {busy === "undo" && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {t("history.editUndo")}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
};

export default EditTransaction;
