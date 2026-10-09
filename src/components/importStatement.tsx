"use client";

import { Check, FileUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { importStatement, previewStatement, type ImportResult, type PreviewResult } from "@/lib/actions/statement.action";
import { cn, formatAmount } from "@/lib/utils";

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

  const reset = () => {
    setPreview(null);
    setResult(null);
  };

  const runPreview = async () => {
    if (!formRef.current) return;
    setBusy("preview");
    setResult(null);
    try {
      setPreview(await previewStatement(new FormData(formRef.current)));
    } catch {
      setPreview({ ok: false, error: "Could not reach the server. Please try again." });
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
      if (outcome.ok) {
        if (fileRef.current) fileRef.current.value = "";
        setFileName(null);
        setPreview(null);
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: "Could not reach the server. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const onFileChosen = (file?: File | null) => {
    setFileName(file?.name ?? null);
    reset();
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

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (preview?.ok) runImport();
        else runPreview();
      }}
      className={cn("flex w-full flex-col gap-4", variant === "primary" && "rounded-md border border-line bg-surface-low p-4")}
    >
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
          dragging ? "border-primary bg-surface-container" : "border-line bg-surface-low hover:border-primary"
        )}
      >
        <span className="flex-center size-10 rounded-md bg-card text-ink-muted">
          {fileName ? <Check className="size-5 text-success" /> : <Upload className="size-5" />}
        </span>
        <span className="text-14 font-semibold text-ink">{fileName ?? "Drop your bank statement here"}</span>
        <span className="field-hint">CSV or XLSX export from net banking · up to 5 MB</span>
        <input
          ref={fileRef}
          id="statement-file"
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="sr-only"
          onChange={(e) => onFileChosen(e.target.files?.[0])}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div className="field">
          <label className="field-label" htmlFor="statement-institution">
            Bank name
          </label>
          <Input
            id="statement-institution"
            name="institution"
            placeholder={preview?.ok && preview.institution ? preview.institution : "Detected from the file if left blank"}
            className="field-input"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="statement-mask">
            Last 4 digits
          </label>
          <Input
            id="statement-mask"
            name="mask"
            placeholder={preview?.ok && preview.mask ? preview.mask : "0000"}
            className="field-input font-mono"
            maxLength={4}
            inputMode="numeric"
          />
        </div>
      </div>

      {preview && !preview.ok && <p className="field-error">{preview.error}</p>}

      {preview?.ok && (
        <div className="panel overflow-hidden">
          <header className="panel-head">
            <span className="eyebrow">
              Parsed {"// "}{preview.total} {preview.total === 1 ? "transaction" : "transactions"} · {preview.currency}
            </span>
            <span className="eyebrow">Showing first {preview.rows.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-13">
              <thead>
                <tr className="border-b border-line bg-surface-low">
                  <th className="eyebrow px-3 py-2 text-left font-normal">Date</th>
                  <th className="eyebrow px-3 py-2 text-left font-normal">Description</th>
                  <th className="eyebrow px-3 py-2 text-left font-normal max-sm:hidden">Category</th>
                  <th className="eyebrow px-3 py-2 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-12 text-ink-muted">{row.date}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-ink">{row.name}</td>
                    <td className="px-3 py-2 max-sm:hidden">
                      <span className="chip">{row.category}</span>
                    </td>
                    <td className={cn("amount px-3 py-2 text-right font-semibold", row.type === "debit" ? "text-danger" : "text-success")}>
                      {row.type === "debit" ? "-" : "+"}
                      {formatAmount(Math.abs(row.amount), preview.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.closingBalance !== undefined && (
            <p className="border-t border-line px-3 py-2 text-12 text-ink-muted">
              Closing balance detected: <span className="amount text-ink">{formatAmount(preview.closingBalance, preview.currency)}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy !== null || !fileName} className={preview?.ok ? "btn-primary" : "btn-secondary"}>
          {busy === "preview" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Reading file
            </>
          ) : busy === "import" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Importing
            </>
          ) : preview?.ok ? (
            <>
              <FileUp className="size-4" /> Import {preview.total} transactions
            </>
          ) : (
            "Preview statement"
          )}
        </button>
        {preview?.ok && (
          <button type="button" onClick={reset} className="btn-ghost">
            Discard
          </button>
        )}
      </div>

      {result && !result.ok && <p className="field-error">{result.error}</p>}
      {result && result.ok && (
        <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-13 text-success">
          {result.institution} ••{result.mask}: {result.imported} new {result.imported === 1 ? "transaction" : "transactions"} imported
          {result.skipped ? `, ${result.skipped} already present` : ""}.
        </p>
      )}

      <p className="field-hint">The file is parsed on this server only and is not stored.</p>
    </form>
  );
};

export default ImportStatement;
