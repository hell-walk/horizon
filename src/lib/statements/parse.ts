// Parses bank statement exports (CSV, Excel or PDF) into normalised transactions.
//
// Indian net-banking exports differ per bank, but nearly all of them are a table
// with a date, a narration/description, either separate debit and credit columns
// or one amount column with a Dr/Cr marker, and a running balance. This parser
// finds those columns by their header names instead of hard-coding one layout.

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

import { decryptXlsx, isEncryptedXlsx, parseLegacyXlsRows, parsePdfRows, StatementPasswordError } from "./unlock";

export { StatementPasswordError };

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
  columns: StatementMapping; // which column was read as what, so the user can correct it
  check: BalanceCheck;
};

export class StatementParseError extends Error {}

const MAX_HEADER_SCAN_ROWS = 60;

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/** Which column holds what, when the user maps a layout the parser could not read. */
export type StatementMapping = {
  date: number;
  name: number;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: number; // a separate Dr/Cr column next to a single amount
  balance?: number;
  reference?: number;
};

type ReadInput = {
  name: string;
  buffer: Buffer;
  password?: string; // for protected PDFs and encrypted Excel files; used once, never stored
};

/** Reads any supported file into rows of cells, before any column is interpreted. */
export async function readStatementRows({ name, buffer: input, password }: ReadInput): Promise<Cell[][]> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const buffer = toUtf8(input);
  // Trust the bytes over the extension: banks hand out HTML tables and tab-separated
  // text under an .xls name, and some ".xlsx" files are old binary workbooks.
  const kind = sniff(buffer, ext);

  if (kind === "pdf") return parsePdfRows(buffer, password);
  if (kind === "xlsx") {
    const unlocked = (await isEncryptedXlsx(buffer)) ? await decryptXlsx(buffer, password) : buffer;
    return parseXlsx(unlocked);
  }
  if (kind === "xls") return parseLegacyXlsRows(buffer, password);
  if (kind === "html") return parseHtmlTable(buffer.toString("utf8"));
  if (kind === "text") return parseDelimited(buffer.toString("utf8"));
  throw new StatementParseError("Unsupported file type. Upload a .csv, .xls, .xlsx or .pdf statement.");
}

/** Thrown when the columns cannot be worked out; the caller can offer column mapping. */
export class StatementLayoutError extends StatementParseError {}

/**
 * Turns rows into a statement: the columns come from the user's mapping when
 * given, else a header row, else inference from the data. Transactions are put
 * in date order and their running balances are checked.
 */
export function buildStatement(rows: Cell[][], name: string, mapping?: StatementMapping): ParsedStatement {
  const header: { index: number; columns: Columns; raw: string[] } | null = mapping
    ? { index: -1, columns: mapping, raw: mappingLabels(mapping) }
    : (findHeaderRow(rows) ?? inferColumns(rows));

  if (!header) {
    // Show the row that looked most like a header, so an unknown layout can be added.
    const closest = rows
      .slice(0, MAX_HEADER_SCAN_ROWS)
      .map((row) => row.map((c) => String(c ?? "").trim()).filter(Boolean))
      .filter((cells) => cells.length >= 3)
      .sort((x, y) => y.length - x.length)[0];
    const firstLines = rows
      .map((row) => row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" "))
      .filter(Boolean)
      .slice(0, 2)
      .map((line) => line.slice(0, 60));
    const hint = closest
      ? ` The closest row was: ${closest.slice(0, 8).map((c) => c.slice(0, 24)).join(" | ")}.`
      : firstLines.length
        ? ` The file starts with: ${firstLines.join(" / ")}.`
        : "";
    throw new StatementLayoutError(
      `Could not find the transactions table. The file needs a header row with a date, a description and debit/credit or amount columns.${hint}`
    );
  }

  // A user-mapped single amount column with no Dr/Cr: the running balance says which way each row went.
  if (mapping && mapping.amount !== undefined && mapping.type === undefined && mapping.balance !== undefined) {
    const data = rows.filter((row) => parseDate(row[mapping.date] ?? null));
    signFromBalance(balanceDeltas(data, mapping.date, mapping.balance), mapping.amount);
  }

  const inFileOrder: ParsedTransaction[] = [];
  let firstDataRow = -1;
  rows.slice(header.index + 1).forEach((row, i) => {
    const transaction = toTransaction(row, header.columns);
    if (!transaction) return;
    if (firstDataRow < 0) firstDataRow = header.index + 1 + i;
    inFileOrder.push(transaction);
  });

  // Oldest first. Newest-first statements are reversed before the (stable) sort so
  // payments on the same day keep their real order and the closing balance is right.
  const newestFirst = inFileOrder.length > 1 && inFileOrder[0].date > inFileOrder[inFileOrder.length - 1].date;
  const transactions = (newestFirst ? [...inFileOrder].reverse() : [...inFileOrder]).sort((a, b) => a.date.localeCompare(b.date));

  const meta = detectMetadata(rows.slice(0, Math.max(header.index + 1, firstDataRow, 0)), name);
  const withBalance = [...transactions].reverse().find((t) => t.balance !== undefined);

  return {
    transactions,
    closingBalance: withBalance?.balance,
    accountMask: meta.accountMask,
    institutionName: meta.institutionName,
    currency: meta.currency ?? "INR",
    headers: header.raw,
    columns: header.columns,
    check: checkBalances(transactions),
  };
}

export async function parseStatement(input: ReadInput & { mapping?: StatementMapping }): Promise<ParsedStatement> {
  return buildStatement(await readStatementRows(input), input.name, input.mapping);
}

function mappingLabels(m: StatementMapping): string[] {
  const width = Math.max(...Object.values(m).filter((v): v is number => typeof v === "number")) + 1;
  const labels: string[] = Array(width).fill("");
  labels[m.date] = "Date";
  labels[m.name] = "Description";
  if (m.debit !== undefined) labels[m.debit] = "Debit";
  if (m.credit !== undefined) labels[m.credit] = "Credit";
  if (m.amount !== undefined) labels[m.amount] = "Amount";
  if (m.balance !== undefined) labels[m.balance] = "Balance";
  if (m.type !== undefined) labels[m.type] = "Dr/Cr";
  if (m.reference !== undefined) labels[m.reference] = "Reference";
  return labels;
}

/* ------------------------------------------------------------------ */
/* Balance check                                                       */
/* ------------------------------------------------------------------ */

export type BalanceCheck = {
  status: "ok" | "mismatch" | "unchecked"; // unchecked: the file carries no running balance
  checked: number; // rows whose balance was verified against the row before
  mismatches: { date: string; name: string; expected: number; actual: number }[];
  opening?: number;
  closing?: number;
  totalIn: number;
  totalOut: number;
};

const signed = (t: ParsedTransaction) => (t.type === "credit" ? t.amount : -t.amount);

/**
 * Proves the statement adds up: each row's balance must equal the previous
 * balance plus money in or minus money out. A row that doesn't is either a
 * misread amount or direction, or a missing row in between.
 */
export function checkBalances(transactions: ParsedTransaction[]): BalanceCheck {
  const totalIn = round2(transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0));
  const totalOut = round2(transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0));
  const balanced = transactions.filter((t) => t.balance !== undefined);
  if (balanced.length < 2) return { status: "unchecked", checked: 0, mismatches: [], totalIn, totalOut };

  const mismatches: BalanceCheck["mismatches"] = [];
  let checked = 0;
  for (let i = 1; i < transactions.length; i++) {
    const before = transactions[i - 1];
    const now = transactions[i];
    if (before.balance === undefined || now.balance === undefined) continue;
    checked++;
    const expected = round2(before.balance + signed(now));
    if (Math.abs(expected - now.balance) > 0.01) mismatches.push({ date: now.date, name: now.name, expected, actual: now.balance });
  }

  return {
    status: mismatches.length ? "mismatch" : "ok",
    checked,
    mismatches,
    opening: round2(balanced[0].balance! - signed(balanced[0])),
    closing: balanced[balanced.length - 1].balance,
    totalIn,
    totalOut,
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

export type Cell = string | number | Date | null;

type FileKind = "pdf" | "xlsx" | "xls" | "html" | "text" | "unknown";

/** UTF-16 text exports (with a byte-order mark) become UTF-8; everything else is untouched. */
function toUtf8(buffer: Buffer): Buffer {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return Buffer.from(buffer.subarray(2).toString("utf16le"), "utf8");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return Buffer.from(swapped.toString("utf16le"), "utf8");
  }
  return buffer;
}

/** Works out what a file really is from its first bytes, falling back to the extension. */
function sniff(buffer: Buffer, ext: string): FileKind {
  const head = buffer.subarray(0, 8);
  if (head.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  // OLE compound file: a binary .xls, or an encrypted .xlsx (both start this way).
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return ext === "xlsx" ? "xlsx" : "xls";
  if (head[0] === 0x50 && head[1] === 0x4b) return "xlsx"; // zip = OOXML
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return sniff(buffer.subarray(3), ext); // UTF-8 BOM

  const text = buffer.subarray(0, 4096).toString("utf8").trimStart().toLowerCase();
  if (text.startsWith("<") && /<table|<html|<!doctype/.test(text)) return "html";
  if (["csv", "txt", "xls", "xlsx", "tsv"].includes(ext)) return "text";
  return "unknown";
}

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, String.fromCharCode(34))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

/** Rows from every <tr> in the document; <td> and <th> become cells, tags are stripped. */
function parseHtmlTable(html: string): Cell[][] {
  const rows: Cell[][] = [];
  const rowMatches = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of rowMatches) {
    const cells = (tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map((td) =>
      decodeEntities(td.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim()
    );
    if (cells.some((c) => c.length)) rows.push(cells);
  }
  return rows;
}

/**
 * Delimited text: tab, comma, semicolon or pipe, whichever splits the most
 * lines into three or more cells (amounts and addresses are full of commas,
 * so a raw character count would pick wrongly).
 */
function parseDelimited(text: string): Cell[][] {
  const lines = text.split(/\r?\n/).slice(0, 40);
  const score = (d: string) => lines.filter((line) => line.split(d).length >= 3).length;
  const best = ["\t", ";", "|", ","].reduce((a, b) => (score(b) > score(a) ? b : a), ",");
  return parseCsv(text, best);
}

function parseCsv(text: string, delimiter = ","): Cell[][] {
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
    else if (ch === delimiter) {
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

type Columns = StatementMapping;

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

    const date = match(cells, [/^(txn|tran|trans|transaction|value|posting|post)? ?date$/, /^date/, /date$/, /^(txn|tran|trans|value|post) dt$/]);
    const name = match(cells, [/narration/, /description/, /particular/, /details/, /remarks/, /transaction (details|remarks)/]);
    if (date < 0 || name < 0 || date === name) continue;

    const debit = match(cells, [/withdrawal/, /debit/, /^dr$/, /dr amount/, /paid out/, /money out/]);
    const credit = match(cells, [/deposit/, /credit/, /^cr$/, /cr amount/, /paid in/, /money in/]);
    const amount = match(cells, [/^amount/, /transaction amount/, /^amt/]);
    const type = match(cells, [/^(dr|cr)\s*\/?\s*(dr|cr)$/, /^type$/, /^txn type$/, /^transaction type$/, /dr cr/]);
    const balance = match(cells, [/balance/, /^bal$/, /^bal\b/, /closing bal/]);
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
/* Header-less statements: infer the columns from the data            */
/* ------------------------------------------------------------------ */

// A money value: has paise ("1.00") or Indian/Western grouping ("2,001").
const MONEY = /^[-(]?\s*(?:₹|rs\.?|inr)?\s*(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?\s*\)?\s*(?:\(?(?:cr|dr)\)?\.?)?$/i;
// What banks print in an empty amount cell.
const EMPTY = /^(?:|-+|–|—|nil|na|n\/a)$/i;

const text = (cell: Cell) => (cell instanceof Date ? "" : String(cell ?? "").trim());
const isMoney = (cell: Cell) => typeof cell === "number" || (MONEY.test(text(cell)) && /[.,]/.test(text(cell)));
const isEmptyCell = (cell: Cell) => cell === null || EMPTY.test(text(cell));

/**
 * When no header row can be found (SBI's newer exports, or a PDF whose column
 * titles run together), work the columns out from the transaction rows:
 * the date column is the one full of dates, the balance is the right-most
 * money column that is always filled, the description is the longest text
 * column, and the money columns just left of the balance are the amounts.
 * Which of those is money in and which is money out is decided by whether the
 * running balance went up or down on each row, so the bank's column order
 * does not matter.
 */
function inferColumns(rows: Cell[][]): { index: number; columns: Columns; raw: string[] } | null {
  const dataIdx = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.some((c) => parseDate(c)) && row.filter(isMoney).length >= 2)
    .map(({ i }) => i);
  if (dataIdx.length < 2) return null;

  const data = dataIdx.map((i) => rows[i]);
  const width = Math.max(...data.map((r) => r.length));
  const n = data.length;
  const share = (fn: (c: Cell) => boolean, j: number) => data.filter((r) => fn(r[j] ?? null)).length / n;

  const dateCol = [...Array(width).keys()].find((j) => share((c) => Boolean(parseDate(c)), j) >= 0.8);
  if (dateCol === undefined) return null;

  // Money columns: mostly money or empty markers, with at least some money.
  const moneyCols = [...Array(width).keys()].filter(
    (j) => j !== dateCol && share(isMoney, j) > 0 && share((c) => isMoney(c) || isEmptyCell(c), j) >= 0.9
  );
  const balance = [...moneyCols].reverse().find((j) => share(isMoney, j) >= 0.9);
  if (balance === undefined) return null;
  const amounts = moneyCols.filter((j) => j < balance).slice(-2);
  if (amounts.length === 0) return null;

  // Description: the column (not date, not money) with the longest text on average.
  const textCols = [...Array(width).keys()].filter((j) => j !== dateCol && !moneyCols.includes(j));
  const avgLength = (j: number) => data.reduce((s, r) => s + text(r[j] ?? null).length, 0) / n;
  const name = textCols.sort((a, b) => avgLength(b) - avgLength(a))[0];
  if (name === undefined) return null;

  // Running balance in date order tells each row's direction.
  const deltas = balanceDeltas(data, dateCol, balance);
  const votesFor = (j: number) => {
    let out = 0;
    let into = 0;
    for (const [row, delta] of deltas) {
      const value = Math.abs(parseAmount(row[j]).value);
      if (!value) continue;
      if (Math.abs(delta + value) < 0.01) out++;
      else if (Math.abs(delta - value) < 0.01) into++;
    }
    return { out, into };
  };

  let debit: number | undefined;
  let credit: number | undefined;
  let amount: number | undefined;
  if (amounts.length === 2) {
    const [a, b] = amounts;
    const va = votesFor(a);
    const vb = votesFor(b);
    // Default to the common layout (debit left of credit) unless the balance says otherwise.
    const aIsCredit = va.into + vb.out > va.out + vb.into;
    debit = aIsCredit ? b : a;
    credit = aIsCredit ? a : b;
  } else {
    amount = amounts[0];
    signFromBalance(deltas, amount);
  }

  const labels: string[] = Array(width).fill("");
  labels[dateCol] = "Date";
  labels[name] = "Description";
  if (debit !== undefined) labels[debit] = "Debit";
  if (credit !== undefined) labels[credit] = "Credit";
  if (amount !== undefined) labels[amount] = "Amount";
  labels[balance] = "Balance";

  return {
    index: dataIdx[0] - 1, // rows before the first transaction are the preamble
    raw: labels,
    columns: { date: dateCol, name, debit, credit, amount, balance },
  };
}

/** How much the running balance moved on each row, taken in date order. */
function balanceDeltas(data: Cell[][], dateCol: number, balance: number): Map<Cell[], number> {
  const chronological = [...data];
  const first = parseDate(chronological[0]?.[dateCol] ?? null) ?? "";
  const last = parseDate(chronological[chronological.length - 1]?.[dateCol] ?? null) ?? "";
  if (first > last) chronological.reverse(); // newest-first statements
  const deltas = new Map<Cell[], number>();
  for (let k = 1; k < chronological.length; k++) {
    const now = parseAmount(chronological[k][balance]).value;
    const before = parseAmount(chronological[k - 1][balance]).value;
    deltas.set(chronological[k], round2(now - before));
  }
  return deltas;
}

/** One unsigned amount column: rows where the balance went down are money out. */
function signFromBalance(deltas: Map<Cell[], number>, amount: number) {
  for (const [row, delta] of deltas) {
    const parsed = parseAmount(row[amount]);
    const value = Math.abs(parsed.value);
    if (value && !parsed.marker && Math.abs(delta + value) < 0.01) row[amount] = -value;
  }
}

/* ------------------------------------------------------------------ */
/* Column mapping: sample rows the user can label                     */
/* ------------------------------------------------------------------ */

export type StatementSample = {
  signature: string; // the layout's fingerprint, to remember the user's mapping for next time
  width: number;
  labels: string[]; // the header row above the transactions, when the file has one
  rows: string[][];
  guess: Partial<StatementMapping>;
};

const SAMPLE_ROWS = 8;
const display = (cell: Cell) => (cell instanceof Date ? (parseDate(cell) ?? "") : String(cell ?? "").replace(/\s+/g, " ").trim());

/**
 * A few transaction-looking rows, plus a guess at the columns, for the user to
 * label when the layout could not be worked out (or was worked out wrong).
 */
export function sampleStatement(rows: Cell[][]): StatementSample {
  // Looser than isMoney: an unknown layout may print "640" or "-640" with no paise.
  const isNumber = (c: Cell) => isMoney(c) || /^[-+(]?\s*\d+(?:\.\d+)?\s*\)?$/.test(text(c));
  const isDataRow = (row: Cell[]) => row.some((c) => parseDate(c)) && row.some(isNumber);
  const firstData = rows.findIndex(isDataRow);
  const data = rows.filter(isDataRow);
  const picked = (data.length ? data : rows.filter((r) => r.filter((c) => display(c)).length >= 3)).slice(0, SAMPLE_ROWS);
  const width = Math.max(0, ...picked.map((r) => r.length));

  // The column titles, if any: the nearest row above the first transaction that reads like a header.
  let labels: string[] = [];
  for (let i = firstData - 1; i >= Math.max(0, firstData - 3); i--) {
    const cells = rows[i].map(display);
    if (cells.filter((c) => c && !isNumber(c) && !parseDate(c)).length >= 3) {
      labels = Array.from({ length: width }, (_, j) => cells[j] ?? "");
      break;
    }
  }

  const n = picked.length || 1;
  const share = (fn: (c: Cell) => boolean, j: number) => picked.filter((r) => fn(r[j] ?? null)).length / n;
  const cols = [...Array(width).keys()];
  // Empty columns count as money so a month without any credits keeps the same fingerprint.
  const kinds = cols.map((j) =>
    share((c) => Boolean(parseDate(c)), j) >= 0.6 ? "d" : share((c) => isNumber(c) || isEmptyCell(c), j) >= 0.9 ? "m" : "t"
  );

  const date = kinds.indexOf("d");
  const balance = [...cols].reverse().find((j) => share(isNumber, j) >= 0.9);
  const avgLength = (j: number) => picked.reduce((s, r) => s + display(r[j] ?? null).length, 0) / n;
  const name = cols.filter((j) => kinds[j] === "t").sort((a, b) => avgLength(b) - avgLength(a))[0];

  return {
    signature: `${kinds.join("")}|${labels.map((l) => norm(l)).join(",")}`.slice(0, 240),
    width,
    labels,
    rows: picked.map((r) => cols.map((j) => display(r[j] ?? null).slice(0, 48))),
    guess: {
      date: date >= 0 ? date : undefined,
      name,
      balance,
    } as Partial<StatementMapping>,
  };
}

const MAPPING_KEYS = ["date", "name", "debit", "credit", "amount", "type", "balance", "reference"] as const;

/**
 * Checks a mapping from the user (or a saved one) against the file: known
 * keys, columns that exist, no column used twice, and enough to read a row.
 * Returns an error message, or null when it is usable.
 */
export function mappingProblem(value: unknown, width: number): string | null {
  if (!value || typeof value !== "object") return "Pick the columns first.";
  const m = value as Record<string, unknown>;
  const used = new Set<number>();
  for (const [key, index] of Object.entries(m)) {
    if (!(MAPPING_KEYS as readonly string[]).includes(key)) return `Unknown column role "${key}".`;
    if (index === undefined) continue;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= width) return "A chosen column is not in the file.";
    if (used.has(index)) return "Each column can only have one role.";
    used.add(index);
  }
  if (m.date === undefined) return "Choose the date column.";
  if (m.name === undefined) return "Choose the description column.";
  const hasPair = m.debit !== undefined || m.credit !== undefined;
  if (!hasPair && m.amount === undefined) return "Choose the money out and money in columns, or a single amount column.";
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

  // Both money columns, or (when the user mapped it so) just one of them.
  const pair = (columns.debit !== undefined && columns.credit !== undefined) || (columns.amount === undefined && (columns.debit ?? columns.credit) !== undefined);
  if (pair) {
    const debit = columns.debit !== undefined ? parseAmount(row[columns.debit]) : { value: 0 };
    const credit = columns.credit !== undefined ? parseAmount(row[columns.credit]) : { value: 0 };
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

  const marker = raw.match(/(?:^|[\s(])(cr|dr)\.?\)?\s*$/i)?.[1]?.toLowerCase();
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw) || /-$/.test(raw);
  // "640,00": a decimal comma (European exports). Indian grouping always ends in
  // three digits ("1,24,560"), so two digits after a final comma (after any dots) is a decimal.
  const decimalComma = raw.lastIndexOf(",") > raw.lastIndexOf(".") && /,\d{2}\D*$/.test(raw);
  const digits = (decimalComma ? raw.replace(/\./g, "").replace(/,(?=\d{2}\D*$)/, ".") : raw).replace(/[^\d.]/g, "");
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

  const account = text.match(/(?:a\/?c|account)\s*(?:no|number|#)?\.?\s*[:.\-]?\s*_?([xX*\d]{6,20})/i)?.[1];
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
