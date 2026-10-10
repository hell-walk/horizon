import JSZip from "jszip";

/**
 * A minimal valid PDF: one page per entry, each page a few lines of text in
 * Helvetica. Enough for pdf.js to read, small enough to build in a test.
 */
export function makePdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length; // returns the object number

  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pagesId = objects.length + 1 + pages.length * 2; // after every page and its content
  const kids: number[] = [];
  for (const lines of pages) {
    const text = lines
      .map((line, i) => `BT /F1 9 Tf 40 ${780 - i * 14} Td (${line.replace(/[()\\]/g, (c) => "\\" + c)}) Tj ET`)
      .join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`)
    );
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** A statement-looking PDF with the given number of pages. */
export const longPdf = (pageCount: number) =>
  makePdf(
    Array.from({ length: pageCount }, (_, p) => [
      "Date    Narration    Debit    Credit    Balance",
      `01/04/2024    UPI PAGE ${p}    10.00        1000.00`,
    ])
  );

/** An .xlsx-shaped zip whose sheet unpacks to `megabytes` of spaces (a zip bomb). */
export async function zipBomb(megabytes = 200): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("xl/worksheets/sheet1.xml", Buffer.alloc(megabytes * 1024 * 1024, 0x20));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

/** A CSV statement with `count` rows whose balances add up. */
export function csvStatement(count: number, name = (i: number) => `UPI ROW ${i}`) {
  let balance = 100_000;
  const rows = ["Date,Narration,Debit,Credit,Balance"];
  for (let i = 0; i < count; i++) {
    balance -= 1;
    rows.push(`01/04/2024,${name(i)},1.00,,${balance.toFixed(2)}`);
  }
  return Buffer.from(rows.join("\n"));
}
