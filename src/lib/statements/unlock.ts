// Opening protected statements. Indian banks email statements as
// password-protected PDFs, and some net-banking Excel exports are encrypted
// too. The password is used once, in memory, to open the file; nothing about
// it is stored or logged.

import type { Cell } from "./parse";

/** Thrown when a file needs a password, or the one given does not open it. */
export class StatementPasswordError extends Error {
  constructor(message: string, public readonly wrongPassword = false) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Excel (OOXML encryption)                                            */
/* ------------------------------------------------------------------ */

type OfficeCrypto = {
  isEncrypted: (buffer: Buffer) => boolean;
  decrypt: (buffer: Buffer, options: { password: string }) => Promise<Buffer>;
};

const officeCrypto = async (): Promise<OfficeCrypto> => (await import("officecrypto-tool")) as unknown as OfficeCrypto;

export async function isEncryptedXlsx(buffer: Buffer) {
  const { isEncrypted } = await officeCrypto();
  return isEncrypted(buffer);
}

export async function decryptXlsx(buffer: Buffer, password?: string): Promise<Buffer> {
  if (!password) throw new StatementPasswordError("This Excel file is password protected. Enter the password to open it.");
  const { decrypt } = await officeCrypto();
  try {
    return await decrypt(buffer, { password });
  } catch {
    throw new StatementPasswordError("That password did not open the Excel file.", true);
  }
}

/* ------------------------------------------------------------------ */
/* Legacy binary .xls (Excel 97-2003), optionally RC4-encrypted        */
/* ------------------------------------------------------------------ */

/**
 * Reads an old binary workbook with SheetJS. Encrypted ones are decrypted
 * first with the given password (same path as .xlsx). Returns the first
 * sheet as rows of raw cell values, dates kept as Date objects.
 */
export async function parseLegacyXlsRows(buffer: Buffer, password?: string): Promise<Cell[][]> {
  const { isEncrypted, decrypt } = await officeCrypto();
  let data = buffer;
  if (isEncrypted(buffer)) {
    if (!password) throw new StatementPasswordError("This Excel file is password protected. Enter the password to open it.");
    try {
      data = await decrypt(buffer, { password });
    } catch {
      throw new StatementPasswordError("That password did not open the Excel file.", true);
    }
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "buffer", cellDates: true, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
  return rows.map((row) =>
    row.map((value) => (value instanceof Date || typeof value === "number" || typeof value === "string" ? value : value === null ? null : String(value)))
  );
}

/* ------------------------------------------------------------------ */
/* PDF: text positions -> table rows                                   */
/* ------------------------------------------------------------------ */

type TextItem = { str: string; transform: number[]; width: number; height: number };
type Span = { text: string; x0: number; x1: number };
type Line = { y: number; spans: Span[] };

const LINE_TOLERANCE = 2.5; // points: items this close vertically are one line
const CELL_GAP = 6; // points: a horizontal gap wider than this starts a new cell
const WRAP_GAP = 16; // points: a line this close below a row can be its wrapped continuation

// A complete date (with a year). "1 Apr" alone is not: its year is on the next line.
const FULL_DATE = /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -,]*\d{2,4}/;
// A money amount: "640.00", "1,24,360.00", "5,000.00 Dr".
const AMOUNT = /^-?\(?[\d,]+\.\d{2}\)?(\s*\(?(cr|dr)\)?\.?)?$/i;
const HEADER_WORDS = /date|desc|narration|particular|detail|remark|debit|credit|withdrawal|deposit|balance|amount/i;

/**
 * Reads every page's text and rebuilds the rows of the statement table from
 * the glyph positions:
 * - items on the same baseline form a line; a wide gap starts a new cell;
 * - the header is the first line with four or more cells and header words,
 *   merged with the line under it when the titles wrap ("Txn" / "Date");
 *   with no readable header, the widest transaction line sets the columns;
 * - every later cell is snapped to those columns, so an empty debit or
 *   credit cell keeps the row aligned;
 * - a line just below a row with no amount and no complete date is that row
 *   wrapping (a long narration, or a date whose year moved down), and is
 *   merged into it cell by cell;
 * - the header repeated on later pages is skipped.
 */
export async function parsePdfRows(buffer: Buffer, password?: string): Promise<Cell[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password,
    useSystemFonts: true,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => {});
    const name = (error as { name?: string }).name;
    if (name === "PasswordException") {
      const code = (error as { code?: number }).code;
      // 1 = a password is needed, 2 = the given password is wrong.
      if (code === 2 || password) throw new StatementPasswordError("That password did not open the PDF.", true);
      throw new StatementPasswordError("This PDF is password protected. Enter the password to open it.");
    }
    throw error;
  }

  const pages: Line[][] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(toLines((content.items as TextItem[]).filter((item) => item.str && item.str.trim().length > 0)));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  // 1. Find the header (and whether its titles wrap onto a second line).
  let anchors: Span[] | null = null;
  let header: { page: number; line: number; end: number } | null = null;
  search: for (let p = 0; p < pages.length; p++) {
    const lines = pages[p];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const next = lines[i + 1];
      const text = line.spans.map((c) => c.text).join(" ");
      const nextText = next ? next.spans.map((c) => c.text).join(" ") : "";
      if (!(line.spans.length >= 4 && HEADER_WORDS.test(text) && (/date/i.test(text) || /date/i.test(nextText)))) continue;

      anchors = line.spans.map((c) => ({ ...c }));
      let end = i;
      if (next && line.y - next.y <= WRAP_GAP && isHeaderTail(next.spans)) {
        for (const span of next.spans) {
          const slot = closestSlot(span, anchors);
          anchors[slot].text = `${anchors[slot].text} ${span.text}`.trim();
        }
        end = i + 1;
      }
      header = { page: p, line: i, end };
      break search;
    }
  }

  // 2. No readable header: the widest line holding a date and an amount sets the columns.
  if (!anchors) {
    let widest: Line | null = null;
    for (const line of pages.flat()) {
      const dated = line.spans.some((c) => FULL_DATE.test(c.text)) && line.spans.some((c) => AMOUNT.test(c.text));
      if (dated && (!widest || line.spans.length > widest.spans.length)) widest = line;
    }
    if (widest && widest.spans.length >= 4) anchors = widest.spans.map((c) => ({ ...c }));
  }

  // 3. Build the rows.
  const rows: Cell[][] = [];
  const headerKey = header && anchors ? keyOf(anchors.map((a) => a.text).join(" ")) : "";

  for (let p = 0; p < pages.length; p++) {
    const lines = pages[p];
    let last: { row: Cell[]; y: number } | null = null; // the row a wrapped line may belong to

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!anchors) {
        rows.push(line.spans.map((c) => c.text));
        continue;
      }

      if (header && (p < header.page || (p === header.page && i < header.line))) {
        rows.push(line.spans.map((c) => c.text)); // preamble above the header
        continue;
      }
      if (header && p === header.page && i === header.line) {
        rows.push(anchors.map((a) => a.text));
        i = header.end;
        continue;
      }

      // The header again at the top of a later page (one or two lines).
      const text = line.spans.map((c) => c.text).join(" ");
      if (headerKey && headerKey.startsWith(keyOf(text)) && keyOf(text).length > 6) {
        last = null;
        continue;
      }

      const row = snapToColumns(line.spans, anchors);
      const hasAmount = line.spans.some((c) => AMOUNT.test(c.text));
      const hasDate = line.spans.some((c) => FULL_DATE.test(c.text));

      if (last && !hasAmount && !hasDate && last.y - line.y <= WRAP_GAP) {
        // Wrapped continuation of the row above: join it cell by cell.
        row.forEach((cell, slot) => {
          if (cell === null) return;
          const above = last!.row[slot];
          last!.row[slot] = above === null ? cell : `${String(above)} ${cell}`;
        });
        last.y = line.y;
        continue;
      }

      rows.push(row);
      last = { row, y: line.y };
    }
  }

  return rows;
}

const keyOf = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");

/** A second header line: short title words, no amounts, no dates. */
const isHeaderTail = (spans: Span[]) =>
  spans.length > 0 && spans.every((c) => !AMOUNT.test(c.text) && !FULL_DATE.test(c.text) && c.text.length <= 24);

/** Groups text items into lines by baseline, top of the page first, then into cells. */
function toLines(items: TextItem[]): Line[] {
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const item of [...items].sort((a, b) => b.transform[5] - a.transform[5])) {
    const y = item.transform[5];
    const line = lines.find((l) => Math.abs(l.y - y) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y, items: [item] });
  }
  return lines
    .map((l) => ({ y: l.y, spans: toSpans(l.items.sort((a, b) => a.transform[4] - b.transform[4])) }))
    .filter((l) => l.spans.length > 0);
}

/** Merges neighbouring items of one line into cells, splitting on wide gaps. */
function toSpans(items: TextItem[]): Span[] {
  const spans: Span[] = [];
  let current: Span | null = null;
  for (const item of items) {
    const x0 = item.transform[4];
    const x1 = x0 + (item.width || item.str.length * (item.height || 5) * 0.5);
    if (current && x0 - current.x1 > CELL_GAP) {
      spans.push(current);
      current = null;
    }
    if (current) {
      current.text += (x0 - current.x1 > 0.5 ? " " : "") + item.str;
      current.x1 = Math.max(current.x1, x1);
    } else {
      current = { text: item.str, x0, x1 };
    }
  }
  if (current) spans.push(current);
  return spans.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text);
}

/** Column boundaries run from each header cell's start to the next one's start. */
const boundsOf = (anchors: Span[]) =>
  anchors.map((a, i) => ({ x0: i === 0 ? -Infinity : a.x0 - CELL_GAP, x1: anchors[i + 1] ? anchors[i + 1].x0 - CELL_GAP : Infinity }));

/** The header column a cell overlaps most. */
function closestSlot(cell: Span, anchors: Span[]) {
  let slot = 0;
  let overlap = -Infinity;
  boundsOf(anchors).forEach((b, i) => {
    const o = Math.min(cell.x1, b.x1) - Math.max(cell.x0, b.x0);
    if (o > overlap) {
      overlap = o;
      slot = i;
    }
  });
  return slot;
}

/**
 * Places each cell in the header column it overlaps most; cells landing in
 * the same column are joined. Missing columns stay null so debit, credit and
 * balance keep their places.
 */
function snapToColumns(spans: Span[], anchors: Span[]): Cell[] {
  const row: Cell[] = anchors.map(() => null);
  for (const cell of spans) {
    const slot = closestSlot(cell, anchors);
    row[slot] = row[slot] === null ? cell.text : `${String(row[slot])} ${cell.text}`;
  }
  return row;
}
