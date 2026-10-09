// Parses bank statement exports (CSV or Excel) into normalised transactions.
//
// Indian net-banking exports differ per bank, but nearly all of them are a table
// with a date, a narration/description, either separate debit and credit columns
// or one amount column with a Dr/Cr marker, and a running balance. This parser
// finds those columns by their header names instead of hard-coding one layout.

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  name: string;
  amount: number; // always positive
  type: "debit" | "credit";
  balance?: number;
  reference?: string;
};

export type ParsedStatement = {
  transactions: ParsedTransaction[];
  closingBalance?: number;
  accountMask?: string;
  institutionName?: string;
  currency: string;
  headers: string[];
};

export class StatementParseError extends Error {}

const MAX_HEADER_SCAN_ROWS = 60;

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function parseStatement({ name, buffer }: { name: string; buffer: Buffer }): Promise<ParsedStatement> {
  const ext = name.toLowerCase().split(".").pop() ?? "";

  let rows: Cell[][];
  if (ext === "csv" || ext === "txt") {
    rows = parseCsv(buffer.toString("utf8"));
  } else if (ext === "xlsx") {
    rows = await parseXlsx(buffer);
  } else if (ext === "xls") {
    throw new StatementParseError("Old .xls files are not supported. Export the statement as .xlsx or .csv instead.");
  } else {
    throw new StatementParseError("Unsupported file type. Upload a .csv or .xlsx statement export.");
  }

  const header = findHeaderRow(rows);
  if (!header) {
    throw new StatementParseError(
      "Could not find the transactions table. The file needs a header row with a date, a description and debit/credit or amount columns."
    );
  }

  const transactions: ParsedTransaction[] = [];
  for (const row of rows.slice(header.index + 1)) {
    const transaction = toTransaction(row, header.columns);
    if (transaction) transactions.push(transaction);
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const meta = detectMetadata(rows.slice(0, header.index + 1), name);
  const withBalance = [...transactions].reverse().find((t) => t.balance !== undefined);

  return {
    transactions,
    closingBalance: withBalance?.balance,
    accountMask: meta.accountMask,
    institutionName: meta.institutionName,
    currency: meta.currency ?? "INR",
    headers: header.raw,
  };
}

/** Stable id for a transaction so re-importing a statement skips rows already stored. */
export function transactionHash(bankId: string, t: ParsedTransaction) {
  return createHash("sha256")
    .update([bankId, t.date, t.name.toLowerCase(), t.amount.toFixed(2), t.type, t.balance?.toFixed(2) ?? ""].join("|"))
    .digest("hex");
}

/* ------------------------------------------------------------------ */
/* File readers                                                        */
/* ------------------------------------------------------------------ */

type Cell = string | number | Date | null;

function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function parseXlsx(buffer: Buffer): Promise<Cell[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: Cell[] = [];
    // ExcelJS cell arrays are 1-based; index 0 is unused.
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellValue(row.getCell(c).value));
    rows.push(cells);
  });
  return rows;
}

function cellValue(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("hyperlink" in value) {
      const link = value as unknown as ExcelJS.CellHyperlinkValue;
      return String(link.text ?? link.hyperlink);
    }
  }
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Header detection                                                    */
/* ------------------------------------------------------------------ */

type Columns = {
  date: number;
  name: number;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: number;
  balance?: number;
  reference?: number;
};

const norm = (cell: Cell) =>
  String(cell ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();

const match = (cells: string[], patterns: RegExp[]) => cells.findIndex((c) => patterns.some((p) => p.test(c)));

function findHeaderRow(rows: Cell[][]): { index: number; columns: Columns; raw: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, MAX_HEADER_SCAN_ROWS); i++) {
    const cells = rows[i].map(norm);
    if (cells.filter(Boolean).length < 3) continue;

    const date = match(cells, [/^(txn|tran|transaction|value|posting)? ?date$/, /^date/, /date$/]);
    const name = match(cells, [/narration/, /description/, /particular/, /details/, /remarks/, /transaction (details|remarks)/]);
    if (date < 0 || name < 0 || date === name) continue;

    const debit = match(cells, [/withdrawal/, /debit/, /^dr$/, /dr amount/, /paid out/, /money out/]);
    const credit = match(cells, [/deposit/, /credit/, /^cr$/, /cr amount/, /paid in/, /money in/]);
    const amount = match(cells, [/^amount/, /transaction amount/, /^amt/]);
    const type = match(cells, [/^(dr|cr)\s*\/?\s*(dr|cr)$/, /^type$/, /^txn type$/, /^transaction type$/, /dr cr/]);
    const balance = match(cells, [/balance/]);
    const reference = match(cells, [/chq/, /cheque/, /ref/, /utr/, /transaction id/, /^id$/]);

    const hasAmounts = (debit >= 0 && credit >= 0) || amount >= 0;
    if (!hasAmounts) continue;

    return {
      index: i,
      raw: rows[i].map((c) => String(c ?? "")),
      columns: {
        date,
        name,
        debit: debit >= 0 ? debit : undefined,
        credit: credit >= 0 ? credit : undefined,
        amount: amount >= 0 ? amount : undefined,
        type: type >= 0 ? type : undefined,
        balance: balance >= 0 && balance !== amount ? balance : undefined,
        reference: reference >= 0 && reference !== name ? reference : undefined,
      },
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Row conversion                                                      */
/* ------------------------------------------------------------------ */

function toTransaction(row: Cell[], columns: Columns): ParsedTransaction | null {
  const date = parseDate(row[columns.date]);
  if (!date) return null; // totals, blank lines, footers

  const name = String(row[columns.name] ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;

  let amount = 0;
  let type: "debit" | "credit" | null = null;

  if (columns.debit !== undefined && columns.credit !== undefined) {
    const debit = parseAmount(row[columns.debit]);
    const credit = parseAmount(row[columns.credit]);
    if (debit.value > 0) {
      amount = debit.value;
      type = "debit";
    } else if (credit.value > 0) {
      amount = credit.value;
      type = "credit";
    }
  }

  if (type === null && columns.amount !== undefined) {
    const parsed = parseAmount(row[columns.amount]);
    const marker = columns.type !== undefined ? norm(row[columns.type]) : parsed.marker;
    amount = Math.abs(parsed.value);
    if (marker && /^(dr|debit|withdrawal|w)$/.test(marker)) type = "debit";
    else if (marker && /^(cr|credit|deposit|d)$/.test(marker)) type = "credit";
    else if (parsed.value !== 0) type = parsed.value < 0 ? "debit" : "credit";
  }

  if (type === null || amount <= 0) return null;

  const balance = columns.balance !== undefined ? parseAmount(row[columns.balance]) : null;
  const reference = columns.reference !== undefined ? String(row[columns.reference] ?? "").trim() : "";

  return {
    date,
    name,
    amount: round2(amount),
    type,
    balance: balance && balance.raw ? round2(balance.value) : undefined,
    reference: reference || undefined,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Accepts the date styles Indian banks use (day first) and returns YYYY-MM-DD. */
export function parseDate(cell: Cell): string | null {
  if (cell instanceof Date && !isNaN(cell.getTime())) return iso(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  if (typeof cell === "number") {
    // Excel serial date
    if (cell > 20000 && cell < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + cell * 86400000);
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  const s = String(cell ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); // dd/mm/yyyy
  if (m) return iso(fullYear(+m[3]), +m[2], +m[1]);

  m = s.match(/^(\d{1,2})[ /-]([a-z]{3,9})[ /,-]*(\d{2,4})/i); // 05 Oct 2026, 05-Oct-26
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(fullYear(+m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);

  return null;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const iso = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

/** "1,23,456.78 Cr" -> { value: 123456.78, marker: "cr" }. Negative values keep their sign. */
export function parseAmount(cell: Cell): { value: number; marker?: string; raw: string } {
  if (typeof cell === "number") return { value: cell, raw: String(cell) };
  const raw = String(cell ?? "").trim();
  if (!raw) return { value: 0, raw };

  const marker = raw.match(/\b(cr|dr)\b\.?$/i)?.[1]?.toLowerCase();
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw) || /-$/.test(raw);
  const digits = raw.replace(/[^\d.]/g, "");
  const value = digits ? parseFloat(digits) : 0;
  return { value: negative ? -value : value, marker, raw };
}

/* ------------------------------------------------------------------ */
/* Statement metadata                                                  */
/* ------------------------------------------------------------------ */

const BANKS: [RegExp, string][] = [
  [/hdfc/i, "HDFC Bank"],
  [/icici/i, "ICICI Bank"],
  [/state bank|\bsbi\b/i, "State Bank of India"],
  [/axis/i, "Axis Bank"],
  [/kotak/i, "Kotak Mahindra Bank"],
  [/idfc/i, "IDFC First Bank"],
  [/yes bank/i, "Yes Bank"],
  [/indusind/i, "IndusInd Bank"],
  [/federal/i, "Federal Bank"],
  [/bank of baroda|\bbob\b/i, "Bank of Baroda"],
  [/punjab national|\bpnb\b/i, "Punjab National Bank"],
  [/canara/i, "Canara Bank"],
  [/union bank/i, "Union Bank of India"],
  [/au small/i, "AU Small Finance Bank"],
];

function detectMetadata(rows: Cell[][], fileName: string) {
  const text = [fileName, ...rows.map((r) => r.map((c) => String(c ?? "")).join(" "))].join("\n");

  const institutionName = BANKS.find(([pattern]) => pattern.test(text))?.[1];

  const account = text.match(/(?:a\/?c|account)\s*(?:no|number|#)?\s*[:.\-]?\s*([xX*\d]{6,20})/i)?.[1];
  const accountMask = account?.replace(/\D/g, "").slice(-4) || undefined;

  const currency = /\bUSD\b|\$/.test(text) && !/\bINR\b|₹|rs\.?/i.test(text) ? "USD" : "INR";

  return { institutionName, accountMask, currency };
}

/* ------------------------------------------------------------------ */
/* Categories shown as chips in the transaction table                  */
/* ------------------------------------------------------------------ */

const CATEGORY_RULES: [RegExp, string][] = [
  [/swiggy|zomato|dominos|mcdonald|starbucks|kfc|pizza|cafe|restaurant|food|bakery|dunkin|subway/i, "Food and Drink"],
  [/salary|sal cr|payroll|interest|int\.?\s*cr|dividend|refund|cashback/i, "Income"],
  [/amazon|flipkart|myntra|ajio|nykaa|bigbasket|blinkit|zepto|dmart|reliance|mart|store/i, "Shopping"],
  [/uber|ola|rapido|irctc|indigo|air india|vistara|makemytrip|redbus|metro|fuel|petrol|hpcl|bpcl|ioc/i, "Travel"],
  [/netflix|spotify|prime|hotstar|youtube|google|apple|jio|airtel|vi\b|bsnl|recharge|broadband|electricity|bescom|tneb|gas|water/i, "Bills"],
  [/atm|cash wdl|cash withdrawal|cwdr/i, "Cash"],
  [/emi|loan|insurance|lic |premium|sip|mutual fund|zerodha|groww|upstox/i, "Finance"],
  [/charge|fee|gst|penalty|sms chg|amb chg/i, "Bank Fees"],
  [/upi|paytm|phonepe|gpay|google pay|bharatpe/i, "Payment"],
  [/neft|imps|rtgs|ft\b|transfer|trf/i, "Transfer"],
];

export function categorize(name: string) {
  return CATEGORY_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "Transfer";
}
