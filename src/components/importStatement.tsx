"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { importStatement, type ImportResult } from "@/lib/actions/statement.action";

type Props = { variant?: "primary" | "ghost" | "default" };

/**
 * "Import statement" button. The user picks a CSV or XLSX export from their
 * net banking; the server parses it and adds the account and its transactions.
 */
const ImportStatement = ({ variant = "default" }: Props) => {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const outcome = await importStatement(new FormData(event.currentTarget));
      setResult(outcome);
      if (outcome.ok) {
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const label = "Import statement";
  const trigger =
    variant === "primary" ? (
      <Button type="button" onClick={() => setOpen((v) => !v)} className="plaidlink-primary">
        {label}
      </Button>
    ) : variant === "ghost" ? (
      <Button type="button" onClick={() => setOpen((v) => !v)} variant="ghost" className="plaidlink-ghost">
        <Image src="/icons/transaction.svg" alt="import" width={24} height={24} />
        <p className="hidden text-[16px] font-semibold text-black-2 xl:block">{label}</p>
      </Button>
    ) : (
      <Button type="button" onClick={() => setOpen((v) => !v)} className="plaidlink-default">
        <Image src="/icons/transaction.svg" alt="import" width={24} height={24} />
        <p className="text-[16px] font-semibold text-black-2">{label}</p>
      </Button>
    );

  return (
    <div className="flex w-full flex-col gap-2">
      {trigger}

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-col gap-1">
            <label className="text-12 font-medium text-gray-700" htmlFor="statement-file">
              Statement export (.csv or .xlsx)
            </label>
            <input
              ref={fileRef}
              id="statement-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="text-14 file:mr-3 file:rounded-md file:border-0 file:bg-blue-25 file:px-3 file:py-1.5 file:text-12 file:font-semibold file:text-blue-700"
            />
          </div>
          <div className="flex gap-2">
            <Input name="institution" placeholder="Bank name (optional)" className="input-class" />
            <Input name="mask" placeholder="Last 4 digits" className="input-class w-28" maxLength={4} inputMode="numeric" />
          </div>

          <Button type="submit" disabled={loading} className="form-btn">
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> &nbsp;Importing...
              </>
            ) : (
              "Import"
            )}
          </Button>

          {result && !result.ok && <p className="form-message">{result.error}</p>}
          {result && result.ok && (
            <p className="text-12 text-success-700">
              {result.institution} ••{result.mask}: {result.imported} new transaction{result.imported === 1 ? "" : "s"} imported
              {result.skipped ? `, ${result.skipped} already present` : ""}.
            </p>
          )}

          <p className="text-12 text-gray-500">
            Download the statement from your net banking as CSV or Excel. The file is parsed on this server only.
          </p>
        </form>
      )}
    </div>
  );
};

export default ImportStatement;
