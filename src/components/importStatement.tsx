"use client";

import { Check, Columns3, CopyCheck, FileUp, KeyRound, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { importStatement, previewStatement, type ImportResult, type PreviewResult } from "@/lib/actions/statement.action";
import { STATEMENT_BANKS, type StatementBankId } from "@/lib/bankGuides";
import type { Fixes, RowFix } from "@/lib/statements/doubtful";
import type { StatementMapping, StatementSample } from "@/lib/statements/parse";
import { cn, formatAmount } from "@/lib/utils";

import BalanceCheckNote from "./balanceCheck";
import { useT } from "./i18nProvider";
import ColumnMapper, { mappingHint } from "./columnMapper";
import DoubtfulRows from "./doubtfulRows";
import { Input } from "./ui/input";

type Props = { variant?: "primary" | "card" };

/**
 * Statement import in two steps: parse the file and show what was understood,
 * then import once the user confirms. Only the server ever sees the file.
 */
const ImportStatement = ({ variant = "card" }: Props) => {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Column mapping: the rows to label, and the user's choice (sent with every read once set).
  const [mapSample, setMapSample] = useState<StatementSample | null>(null);
  const [mapping, setMapping] = useState<Partial<StatementMapping> | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);
  // "These are new, save them too", for entries that look like ones already saved from another file.
  const [keepLikely, setKeepLikely] = useState(false);
  // Fixes for rows that need a look, keyed by their place in the file. "dirty" until the
  // file has been read again with them, so the counts and the balance check are current.
  const [fixes, setFixes] = useState<Fixes>({});
  const [skipAll, setSkipAll] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fixRow = (index: number, fix: RowFix | null) => {
    setFixes((current) => {
      const next = { ...current };
      if (fix) next[index] = fix;
      else delete next[index];
      return next;
    });
    setDirty(true);
  };
  // Guided import: which bank the statement is from, to show how to get it and its usual password.
  const t = useT();
  const [bank, setBank] = useState<StatementBankId | "">("");
  const institutionRef = useRef<HTMLInputElement>(null);
  const bankName = STATEMENT_BANKS.find((b) => b.id === bank)?.name;
  const chooseBank = (id: StatementBankId | "") => {
    setBank(id);
    const name = STATEMENT_BANKS.find((b) => b.id === id)?.name;
    if (name && institutionRef.current) institutionRef.current.value = name;
    if (id) setShowPassword(true); // bank PDFs are almost always protected
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setKeepLikely(false);
    setFixes({});
    setSkipAll(false);
    setDirty(false);
  };

  const mappingBefore = useRef<Partial<StatementMapping> | null>(null);
  const openMapper = (sample: StatementSample, start: Partial<StatementMapping>) => {
    if (!mapperOpen) mappingBefore.current = mapping;
    setMapSample(sample);
    setMapping(start);
    setMapperOpen(true);
  };

  const closeMapper = () => {
    setMapperOpen(false);
    setMapping(mappingBefore.current); // back to what the shown preview was read with
  };

  // keepChoices: read again with the user's fixes (same file, same columns). Otherwise
  // it is a fresh read, and fixes for the old reading would point at the wrong rows.
  const runPreview = async (keepChoices = false) => {
    if (!formRef.current) return;
    setBusy("preview");
    setResult(null);
    try {
      const data = new FormData(formRef.current);
      if (!keepChoices) {
        data.delete("fixes");
        data.delete("skipDoubtful");
        data.delete("keepLikely");
      }
      const outcome = await previewStatement(data);
      setPreview(outcome);
      if (!keepChoices) {
        setKeepLikely(false);
        setFixes({});
        setSkipAll(false);
      }
      setDirty(false);
      if (!outcome.ok && outcome.needsPassword) setShowPassword(true);
      if (!outcome.ok && outcome.needsMapping && outcome.sample) {
        // Keep what the user already picked; otherwise start from the parser's guess.
        openMapper(outcome.sample, mapping ?? outcome.sample.guess);
      }
      if (outcome.ok) setMapperOpen(false);
    } catch {
      setPreview({ ok: false, error: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!formRef.current) return;
    setBusy("import");
    try {
      const outcome = await importStatement(new FormData(formRef.current));
      setResult(outcome);
      if (!outcome.ok && outcome.needsPassword) setShowPassword(true);
      if (outcome.ok) {
        if (fileRef.current) fileRef.current.value = "";
        setFileName(null);
        setPreview(null);
        setMapping(null);
        setMapSample(null);
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const onFileChosen = (file?: File | null) => {
    setFileName(file?.name ?? null);
    // Bank PDFs are almost always protected; offer the password field right away.
    if (file?.name.toLowerCase().endsWith(".pdf")) setShowPassword(true);
    reset();
    setMapping(null);
    setMapSample(null);
    setMapperOpen(false);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && fileRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileRef.current.files = transfer.files;
      onFileChosen(file);
    }
  };

  // What the save button will really save: not the entries already there, nor the
  // look-alikes unless the user says they are new.
  const toSave = preview?.ok ? preview.total - preview.alreadySaved - (keepLikely ? 0 : preview.likely.count) : null;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (preview?.ok && !mapperOpen && dirty) runPreview(true);
        else if (preview?.ok && !mapperOpen) runImport();
        else runPreview();
      }}
      className={cn("flex w-full flex-col gap-4", variant === "primary" && "rounded-md border border-line bg-surface-low p-4")}
    >
      <div className="field">
        <label className="field-label" htmlFor="statement-bank">
          {t("connect.guideWhichBank")}
        </label>
        <select id="statement-bank" value={bank} onChange={(e) => chooseBank(e.target.value as StatementBankId | "")} className="field-input">
          <option value="">{t("connect.guideChooseBank")}</option>
          {STATEMENT_BANKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="other">{t("connect.guideOtherBank")}</option>
        </select>
      </div>

      {bank && (
        <div className="rounded-md border border-line bg-card p-4 text-14" aria-live="polite">
          <p className="font-semibold text-ink">{t("connect.guideHowTitle")}</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-ink-muted">
            <li>
              {t("connect.guideStep1", {
                bank: bankName ?? t("connect.guideYourBank"),
              })}
            </li>
            <li>{t("connect.guideStep2")}</li>
            <li>{t("connect.guideStep3")}</li>
            <li>{t("connect.guideStep4")}</li>
          </ol>
          <p className="mt-3 font-semibold text-ink">{t("connect.guidePasswordTitle")}</p>
          <p className="text-ink-muted">{t(`connect.guidePassword_${bank}`)}</p>
          <p className="field-hint mt-2">{t("connect.guideCheckEmail")}</p>
        </div>
      )}

      <label
        htmlFor="statement-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-surface-container" : "border-line bg-surface-low hover:border-primary",
        )}
      >
        <span className="flex-center size-10 rounded-md bg-card text-ink-muted">
          {fileName ? <Check className="size-5 text-success" /> : <Upload className="size-5" />}
        </span>
        {fileName ? (
          <span translate="no" className="text-14 font-semibold text-ink">
            {fileName}
          </span>
        ) : (
          <span className="text-14 font-semibold text-ink">{t("connect.dropHere")}</span>
        )}
        <span className="field-hint">{t("connect.fileTypes")}</span>
        <input
          ref={fileRef}
          id="statement-file"
          name="file"
          type="file"
          accept=".csv,.xls,.xlsx,.pdf,.txt,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="sr-only"
          onChange={(e) => onFileChosen(e.target.files?.[0])}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div className="field">
          <label className="field-label" htmlFor="statement-institution">
            {t("connect.bankName")}
          </label>
          <Input
            ref={institutionRef}
            id="statement-institution"
            name="institution"
            placeholder={preview?.ok && preview.institution ? preview.institution : t("connect.bankNamePlaceholder")}
            className="field-input"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="statement-mask">
            {t("connect.last4")}
          </label>
          <Input
            id="statement-mask"
            name="mask"
            placeholder={preview?.ok && preview.mask ? preview.mask : "0000"}
            className="field-input font-mono"
            translate="no"
            maxLength={4}
            inputMode="numeric"
          />
        </div>
      </div>

      {showPassword ? (
        <div className="field">
          <div className="flex items-center justify-between">
            <label className="field-label" htmlFor="statement-password">
              {t("connect.filePassword")}
            </label>
            <span className="eyebrow">{t("connect.passwordNeverSaved")}</span>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              id="statement-password"
              name="password"
              type="password"
              autoComplete="off"
              placeholder={t("connect.passwordPlaceholder")}
              className="field-input pl-10 font-mono"
            />
          </div>
          <p className="field-hint">{t("connect.passwordHint")}</p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowPassword(true)} className="btn-ghost btn-sm w-fit -ml-2">
          <KeyRound className="size-3.5" /> {t("connect.hasPassword")}
        </button>
      )}

      {mapping && <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />}

      {preview && !preview.ok && <p className={preview.needsPassword || preview.needsMapping ? "field-hint text-warn-ink" : "field-error"}>{preview.error}</p>}

      {mapperOpen && mapSample && mapping && <ColumnMapper sample={mapSample} mapping={mapping} onChange={setMapping} />}

      {preview?.ok && !mapperOpen && (
        <div className="panel overflow-hidden">
          <header className="panel-head">
            <span className="eyebrow">
              {t("connect.foundEntries", { count: preview.total })} · <span translate="no">{preview.currency}</span>
            </span>
            <span className="eyebrow">{t("connect.showingFirst", { count: preview.rows.length })}</span>
          </header>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("connect.tableScrolls")}>
            <table className="w-full text-13">
              <thead>
                <tr className="border-b border-line bg-surface-low">
                  <th className="eyebrow px-3 py-2 text-left font-normal">{t("connect.colDate")}</th>
                  <th className="eyebrow px-3 py-2 text-left font-normal">{t("connect.colDetails")}</th>
                  <th className="eyebrow px-3 py-2 text-left font-normal max-sm:hidden">{t("connect.colCategory")}</th>
                  <th className="eyebrow px-3 py-2 text-right font-normal">{t("connect.colAmount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    <td translate="no" className="px-3 py-2 font-mono text-12 text-ink-muted">
                      {row.date}
                    </td>
                    <td translate="no" className="max-w-[260px] truncate px-3 py-2 text-ink">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 max-sm:hidden">
                      <span className="chip">{row.category}</span>
                    </td>
                    <td translate="no" className={cn("amount px-3 py-2 text-right font-semibold", row.type === "debit" ? "text-danger" : "text-success")}>
                      {row.type === "debit" ? "-" : "+"}
                      {formatAmount(Math.abs(row.amount), preview.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BalanceCheckNote check={preview.check} currency={preview.currency} />
          {preview.doubtful.count > 0 && (
            <DoubtfulRows
              count={preview.doubtful.count}
              rows={preview.doubtful.rows}
              total={preview.total + preview.doubtfulSkipped}
              currency={preview.currency}
              fixes={fixes}
              onFix={fixRow}
              skipAll={skipAll}
              onSkipAll={(skip) => {
                setSkipAll(skip);
                setDirty(true);
              }}
            />
          )}
          {(preview.changed > 0 || preview.doubtfulSkipped > 0) && !dirty && (
            <p className="border-t border-line px-3 py-2 text-13 text-ink">
              {t("connect.doubtApplied", { changed: preview.changed, skipped: preview.doubtfulSkipped })}
            </p>
          )}
          <input type="hidden" name="fixes" value={JSON.stringify(fixes)} />
          {skipAll && <input type="hidden" name="skipDoubtful" value="1" />}
          {preview.alreadySaved > 0 && (
            <p className="flex items-start gap-2 border-t border-line px-3 py-2 text-13 text-ink">
              <CopyCheck className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden /> {t("connect.alreadySaved", { count: preview.alreadySaved })}
            </p>
          )}
          {preview.likely.count > 0 && (
            <div className="flex flex-col gap-2 border-t border-line bg-warn/10 px-3 py-3 text-13 text-ink">
              <p className="font-semibold">{t("connect.likelyTitle", { count: preview.likely.count })}</p>
              <p>{t("connect.likelyBody")}</p>
              <details>
                <summary className="cursor-pointer font-semibold underline underline-offset-2">{t("connect.likelyShow")}</summary>
                <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={t("connect.tableScrolls")}>
                  <table className="w-full text-12">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="eyebrow px-2 py-1 text-left font-normal">{t("connect.likelyInFile")}</th>
                        <th className="eyebrow px-2 py-1 text-left font-normal">{t("connect.likelySaved")}</th>
                        <th className="eyebrow px-2 py-1 text-right font-normal">{t("connect.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {preview.likely.rows.map((row, i) => (
                        <tr key={i} translate="no">
                          <td className="px-2 py-1.5 align-top">
                            <span className="block font-mono text-ink-muted">{row.date}</span>
                            <span className="break-words">{row.name}</span>
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <span className="block font-mono text-ink-muted">{row.savedDate}</span>
                            <span className="break-words">{row.savedName}</span>
                          </td>
                          <td className={cn("amount px-2 py-1.5 text-right align-top font-semibold", row.type === "debit" ? "text-danger" : "text-success")}>
                            {row.type === "debit" ? "-" : "+"}
                            {formatAmount(Math.abs(row.amount), preview.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.likely.count > preview.likely.rows.length && (
                    <p className="mt-1 text-ink-muted">
                      {t("connect.likelyMore", {
                        count: preview.likely.count - preview.likely.rows.length,
                      })}
                    </p>
                  )}
                </div>
              </details>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="keepLikely"
                  value="1"
                  checked={keepLikely}
                  onChange={(e) => setKeepLikely(e.target.checked)}
                  className="mt-0.5 size-4"
                />
                {t("connect.likelyKeep")}
              </label>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-12 text-ink-muted">
            <span>
              {preview.source === "saved"
                ? t("connect.sourceSaved")
                : preview.source === "manual"
                  ? t("connect.sourceManual")
                  : t("connect.sourceAuto", {
                      columns: preview.headers.join(", "),
                    })}
            </span>
            <button type="button" onClick={() => openMapper(preview.sample, preview.columns)} className="btn-ghost btn-sm shrink-0">
              <Columns3 className="size-3.5" /> {t("connect.changeColumns")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy !== null || !fileName || (mapperOpen && mapping !== null && mappingHint(mapping) !== null) || (!mapperOpen && !dirty && toSave === 0)}
          className={preview?.ok && !mapperOpen ? "btn-primary" : "btn-secondary"}
        >
          {busy === "preview" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("connect.readingFile")}
            </>
          ) : busy === "import" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("connect.saving")}
            </>
          ) : mapperOpen ? (
            t("connect.readWithColumns")
          ) : preview?.ok && !mapperOpen && dirty ? (
            t("connect.doubtCheckAgain")
          ) : preview?.ok && toSave === 0 ? (
            t("connect.nothingNew")
          ) : preview?.ok ? (
            <>
              <FileUp className="size-4" /> {t("connect.saveEntries", { count: toSave ?? 0 })}
            </>
          ) : (
            t("connect.readFile")
          )}
        </button>
        {mapperOpen && preview?.ok && (
          <button type="button" onClick={closeMapper} className="btn-ghost">
            {t("common.cancel")}
          </button>
        )}
        {preview?.ok && !mapperOpen && (
          <button type="button" onClick={reset} className="btn-ghost">
            {t("connect.startAgain")}
          </button>
        )}
      </div>

      {result && !result.ok && <p className="field-error">{result.error}</p>}
      {result && result.ok && (
        <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-13 text-success">
          <span translate="no">
            {result.institution} ••{result.mask}
          </span>
          : {t("connect.savedNew", { count: result.imported })}
          {result.skipped ? ` ${t("connect.alreadyThere", { count: result.skipped })}` : ""}
          {result.likelySkipped ? ` ${t("connect.likelySkipped", { count: result.likelySkipped })}` : ""}
          {result.changed ? ` ${t("connect.doubtChangedDone", { count: result.changed })}` : ""}
          {result.doubtfulSkipped ? ` ${t("connect.doubtSkippedDone", { count: result.doubtfulSkipped })}` : ""}
        </p>
      )}

      <p className="field-hint">{t("connect.privacyNote")}</p>
    </form>
  );
};

export default ImportStatement;
