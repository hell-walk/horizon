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
/* PDF: text positions -> table rows                                   */
/* ------------------------------------------------------------------ */

type TextItem = { str: string; transform: number[]; width: number; height: number };
type Span = { text: string; x0: number; x1: number };

const LINE_TOLERANCE = 2.5; // points: items this close vertically are one line
const CELL_GAP = 6; // points: a horizontal gap wider than this starts a new cell
const DATE_LIKE = /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3}[ -]\d{2,4}/;

/**
 * Reads every page's text and rebuilds the rows of the statement table from
 * the glyph positions: items on the same baseline form a line, and a wide
 * horizontal gap between items starts a new cell. Once the header line is
 * found, every later cell is snapped to the header's column positions, so an
 * empty debit or credit column stays empty instead of shifting the row. Lines
 * that carry only text (a wrapped narration) are folded into the row above.
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

  const rows: Cell[][] = [];
  let anchors: Span[] | null = null; // header cells, once found; columns keep their x across pages
  let nameSlot = -1;

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = (content.items as TextItem[]).filter((item) => item.str && item.str.trim().length > 0);

      for (const line of toLines(items)) {
        const spans = toSpans(line);
        if (spans.length === 0) continue;

        if (!anchors) {
          rows.push(spans.map((c) => c.text));
          if (spans.length >= 4 && spans.some((c) => /date/i.test(c.text))) {
            anchors = spans;
            nameSlot = widestSlot(spans);
          }
          continue;
        }

        const row = snapToColumns(spans, anchors);
        const filled = row.filter((c) => c !== null).length;
        const previous = rows[rows.length - 1];

        // Wrapped narration: text only, no date, nothing in the number columns.
        if (filled <= 2 && !spans.some((c) => DATE_LIKE.test(c.text)) && previous && previous.length === anchors.length) {
          const extra = spans.map((c) => c.text).join(" ");
          const target = nameSlot >= 0 && previous[nameSlot] !== null ? nameSlot : previous.findIndex((c) => typeof c === "string");
          if (target >= 0) {
            previous[target] = `${String(previous[target] ?? "")} ${extra}`.trim();
            continue;
          }
        }
        rows.push(row);
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  return rows;
}

/** Groups text items into lines by baseline, top of the page first. */
function toLines(items: TextItem[]) {
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const item of [...items].sort((a, b) => b.transform[5] - a.transform[5])) {
    const y = item.transform[5];
    const line = lines.find((l) => Math.abs(l.y - y) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y, items: [item] });
  }
  return lines.map((l) => l.items.sort((a, b) => a.transform[4] - b.transform[4]));
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

/** The narration column: by header name, else the widest column that is not the last. */
function widestSlot(header: Span[]) {
  const byName = header.findIndex((c) => /narration|description|particular|detail|remark|transaction/i.test(c.text));
  if (byName >= 0) return byName;
  let best = -1;
  let width = -1;
  header.forEach((c, i) => {
    if (i === header.length - 1) return;
    const w = header[i + 1].x0 - c.x0;
    if (w > width) {
      width = w;
      best = i;
    }
  });
  return best;
}

/**
 * Places each cell in the header column it overlaps most (by its horizontal
 * extent); cells landing in the same column are joined. Missing columns stay
 * null so debit, credit and balance keep their places.
 */
function snapToColumns(spans: Span[], anchors: Span[]): Cell[] {
  const row: Cell[] = anchors.map(() => null);
  // Column boundaries run from each header cell's start to the next one's start.
  const bounds = anchors.map((a, i) => ({ x0: i === 0 ? -Infinity : a.x0 - CELL_GAP, x1: anchors[i + 1] ? anchors[i + 1].x0 - CELL_GAP : Infinity }));

  for (const cell of spans) {
    let slot = 0;
    let overlap = -1;
    bounds.forEach((b, i) => {
      const o = Math.min(cell.x1, b.x1) - Math.max(cell.x0, b.x0);
      if (o > overlap) {
        overlap = o;
        slot = i;
      }
    });
    row[slot] = row[slot] === null ? cell.text : `${String(row[slot])} ${cell.text}`;
  }
  return row;
}
