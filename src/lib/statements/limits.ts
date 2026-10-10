// How much work one uploaded statement may cost. The upload cap (10 MB) limits
// the file, not the work: a small .xlsx can unpack to gigabytes and a PDF can
// carry thousands of pages. These bounds sit far above any real bank statement.

export class StatementParseError extends Error {}

export const LIMITS = {
  pdfPages: 200, // a year of daily statements is well under this
  pdfTextItems: 400_000,
  unpackedBytes: 25 * 1024 * 1024, // all parts of an .xlsx once unzipped
  zipEntries: 2_000,
  rows: 50_000,
  parseMs: 25_000,
};

const tooBig = (what: string) =>
  new StatementParseError(`This file is too large to read (${what}). Export a shorter date range and try again.`);

/** A clock for one file: call it between steps; it throws once the time budget is spent. */
export function startBudget(ms = LIMITS.parseMs) {
  const end = Date.now() + ms;
  return () => {
    if (Date.now() > end) throw tooBig("it took too long");
  };
}

export function checkPdfPages(pages: number) {
  if (pages > LIMITS.pdfPages) throw tooBig(`${pages} pages, the limit is ${LIMITS.pdfPages}`);
}

export function checkTextItems(items: number) {
  if (items > LIMITS.pdfTextItems) throw tooBig("too much text");
}

export function checkRows(rows: number) {
  if (rows > LIMITS.rows) throw tooBig(`more than ${LIMITS.rows.toLocaleString("en-IN")} rows`);
}

/**
 * Reads a zip's central directory (without unpacking anything) and rejects it
 * when its parts would unpack to more than the limit: the zip-bomb check run
 * before ExcelJS opens an .xlsx.
 */
export function checkZip(buffer: Buffer) {
  // End-of-central-directory record: within the last 64 KB + 22 bytes.
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new StatementParseError("This Excel file is damaged and cannot be read.");

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (entries === 0xffff || offset === 0xffffffff) throw tooBig("the workbook is too big");
  if (entries > LIMITS.zipEntries) throw tooBig("too many parts");

  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new StatementParseError("This Excel file is damaged and cannot be read.");
    }
    const unpacked = buffer.readUInt32LE(offset + 24);
    if (unpacked === 0xffffffff) throw tooBig("the workbook is too big"); // zip64 entry
    total += unpacked;
    if (total > LIMITS.unpackedBytes) throw tooBig("the workbook unpacks to too much data");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}
