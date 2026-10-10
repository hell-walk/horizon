import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { categorize, parseAmount, parseDate, parseStatement, transactionHash } from "@/lib/statements/parse";

const hdfc = `HDFC BANK LTD\r
Account No : 50100123456789\r
Statement From : 01/09/26 To : 09/10/26\r
\r
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\r
01/09/26,"UPI-SWIGGY-swiggy@axisbank-UTIB0000001-123456",0000123456,01/09/26,"2,500.00",,"1,18,043.75"\r
03/09/26,"SALARY SEP 2026 ACME PVT LTD",NEFT001,03/09/26,,"85,000.00","2,03,043.75"\r
07/09/26,"ATM WDL-KORAMANGALA",ATM9988,07/09/26,"10,000.00",,"1,93,043.75"\r
08/09/26,"AMB CHG INCL GST",,08/09/26,"354.00",,"1,92,689.75"\r
,,,,,,\r
STATEMENT SUMMARY :-,,,,,,\r
Opening Balance,,,,Dr Count,Cr Count,Closing Bal\r
"1,20,543.75",,,,3,1,"1,92,689.75"\r
`;

const sbi = `Account Name,SAVINGS ACCOUNT
Account Number,00000031234567890
Txn Date,Value Date,Description,Ref No./Cheque No.,Amount,Dr/Cr,Balance
05-Oct-26,05-Oct-26,TO TRANSFER-UPI/DR/527/ZOMATO,527,450.50,DR,"45,000.00"
06-Oct-26,06-Oct-26,BY TRANSFER-NEFT*HDFC0000001*INTEREST,NEFT22,1200.00,CR,"46,200.00"
07-Oct-26,07-Oct-26,DEBIT-ATMCard AMC 0000 GST,AMC,236.00,DR,"45,964.00"
`;

async function axisXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Statement");
  ws.addRow(["Axis Bank Ltd"]);
  ws.addRow(["Account No:", "XXXXXXXX4321"]);
  ws.addRow([]);
  ws.addRow(["Tran Date", "Particulars", "Debit", "Credit", "Balance", "Chq No"]);
  ws.addRow([new Date(Date.UTC(2026, 9, 1)), "UPI/P2M/Amazon Pay", 1999, null, 50001, ""]);
  ws.addRow([new Date(Date.UTC(2026, 9, 2)), "IMPS/REFUND/FLIPKART", null, 499, 50500, "IMPS77"]);
  ws.addRow([new Date(Date.UTC(2026, 9, 3)), "NETFLIX.COM", 649, null, 49851, ""]);
  ws.addRow(["", "Total", 2648, 499, "", ""]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("HDFC-style CSV: preamble, separate withdrawal/deposit columns, footer", () => {
  it("reads the four payments and ignores the summary rows", async () => {
    const a = await parseStatement({ name: "Acct_Statement_XX6789_09102026.csv", buffer: Buffer.from(hdfc) });
    expect(a.transactions).toHaveLength(4);
    expect(a.institutionName).toBe("HDFC Bank");
    expect(a.accountMask).toBe("6789");
    expect(a.currency).toBe("INR");
    expect(a.transactions[0]).toMatchObject({ date: "2026-09-01", type: "debit", amount: 2500, reference: "0000123456" });
    expect(a.transactions[1]).toMatchObject({ type: "credit", amount: 85000, balance: 203043.75 });
    expect(a.closingBalance).toBe(192689.75);
  });
});

describe("SBI-style CSV: one amount column plus a Dr/Cr column", () => {
  it("uses the marker for the direction", async () => {
    const b = await parseStatement({ name: "sbi.csv", buffer: Buffer.from(sbi) });
    expect(b.transactions.map((t) => `${t.date} ${t.type} ${t.amount}`)).toEqual([
      "2026-10-05 debit 450.5",
      "2026-10-06 credit 1200",
      "2026-10-07 debit 236",
    ]);
    expect(b.institutionName).toBe("State Bank of India");
    expect(b.accountMask).toBe("7890");
  });
});

describe("Axis-style XLSX: real date cells and numeric amounts", () => {
  it("reads the payments and skips the total row", async () => {
    const c = await parseStatement({ name: "axis.xlsx", buffer: await axisXlsx() });
    expect(c.transactions.map((t) => `${t.date} ${t.type} ${t.amount}`)).toEqual([
      "2026-10-01 debit 1999",
      "2026-10-02 credit 499",
      "2026-10-03 debit 649",
    ]);
    expect(c.institutionName).toBe("Axis Bank");
    expect(c.accountMask).toBe("4321");
    expect(c.closingBalance).toBe(49851);
  });
});

describe("categorize", () => {
  it.each([
    ["UPI-SWIGGY-swiggy@axisbank", "Food and Drink"],
    ["SALARY SEP 2026", "Income"],
    ["ATM WDL-KORAMANGALA", "Cash"],
    ["AMB CHG INCL GST", "Bank Fees"],
    ["NETFLIX.COM", "Bills"],
  ])("%s -> %s", (name, expected) => {
    expect(categorize(name)).toBe(expected);
  });
});

describe("parseDate", () => {
  it.each([
    ["05 Oct 2026", "2026-10-05"],
    ["2026-10-05T00:00:00", "2026-10-05"],
    ["05/10/2026", "2026-10-05"],
    ["05-10-26", "2026-10-05"],
    ["Opening Balance", null],
    ["", null],
  ])("%s -> %s", (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it("reads Excel serial dates", () => {
    expect(parseDate(46300)).toBe("2026-10-05"); // 45658 is 1 Jan 2025
  });
});

describe("parseAmount", () => {
  it.each([
    ["640,00", 640],
    ["1.234,56", 1234.56],
    ["1,24,560.00", 124560],
    ["1,24,560", 124560],
    ["45,000", 45000],
    ["12,34", 12.34],
    ["5,000.00 Dr", 5000],
    ["(500.00)", -500],
    ["640.00 (Dr)", 640],
    ["1,23,456.78 Cr", 123456.78],
  ])("%s -> %d", (raw, expected) => {
    expect(parseAmount(raw).value).toBeCloseTo(expected, 9);
  });

  it("keeps the Dr/Cr marker", () => {
    expect(parseAmount("1,23,456.78 Cr").marker).toBe("cr");
    expect(parseAmount("5,000.00 Dr").marker).toBe("dr");
  });
});

describe("transactionHash", () => {
  const t = { date: "2026-09-01", name: "UPI SWIGGY", amount: 2500, type: "debit" as const, balance: 100 };
  it("is stable for the same row and differs per bank", () => {
    expect(transactionHash("b1", t)).toBe(transactionHash("b1", { ...t }));
    expect(transactionHash("b1", t)).not.toBe(transactionHash("b2", t));
  });
  it("fits Appwrite's 64-character hash column", () => {
    expect(transactionHash("b1", t)).toMatch(/^[0-9a-f]{64}$/);
  });
});
