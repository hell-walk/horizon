// Realistic people, with the narrations Indian banks actually write, and what a
// careful person would conclude: "yes" (a salary, Horizon can be sure), "ask"
// (could be a salary, Horizon should ask), "no" (not a salary). `payee` is the
// employer Horizon should name when the answer is yes or ask. Rows are shaped
// the way statements are stored: every amount positive, the direction in type.

export type Expect = "yes" | "ask" | "no";
export type Profile = { id: string; who: string; expect: Expect; payee?: RegExp; monthly?: number; ownNames?: string[]; rows: Transaction[] };

let n = 0;
const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const lastDay = (m: string) => (m.endsWith("-06") || m.endsWith("-09") ? 30 : 31);
const row = (date: string, name: string, amount: number, type: "credit" | "debit") =>
  ({ id: `p${++n}`, date, name, amount, type, category: "Transfer", paymentChannel: "other" }) as unknown as Transaction;
/** A credit in each month (from `from`), on `day` (capped at the month's end); an amount of 0 skips that month. */
const credits = (name: string | ((i: number) => string), amounts: number[] | number, day = 30, from = 0) =>
  months
    .slice(from)
    .map((m, i) =>
      row(
        `${m}-${String(Math.min(day, lastDay(m))).padStart(2, "0")}`,
        typeof name === "function" ? name(i) : name,
        Array.isArray(amounts) ? amounts[i] : amounts,
        "credit",
      ),
    )
    .filter((t) => Number(t.amount) > 0);
const debits = (name: string, amount: number, day: number) => months.map((m) => row(`${m}-${String(day).padStart(2, "0")}`, name, amount, "debit"));
const MON = ["MAY", "JUN", "JUL", "AUG", "SEP"];

// What many people pay each month, salaried or not.
const life = () => [
  ...months.flatMap((m) => [row(`${m}-04`, "UPI/DR/1/SWIGGY", 340, "debit"), row(`${m}-18`, "UPI/DR/2/ZEPTO", 610, "debit")]),
  ...debits("NETFLIX.COM", 649, 6),
  ...debits("ACH/DR/BAJAJ FINANCE LTD/EMI", 4800, 5),
  ...debits("UPI/DR/3/SURESH GUPTA/SBIN/rent", 12000, 2),
  ...debits("UPI/DR/4/JIO PREP/YESB/", 349, 12),
];

export const PROFILES: Profile[] = [
  // Salaried, the narration says so: Horizon can be sure.
  {
    id: "Y1",
    who: "IT employee, NEFT says SALARY",
    expect: "yes",
    payee: /infosys/i,
    monthly: 62000,
    rows: [...life(), ...credits((i) => `NEFT/CR/INFOSYS LTD/SALARY ${MON[i]}`, 62000)],
  },
  {
    id: "Y2",
    who: "TCS via Citibank, month in narration",
    expect: "yes",
    payee: /tata/i,
    monthly: 54000,
    rows: [...life(), ...credits((i) => `NEFT CR-CITI0100000-TATA CONSULTANCY SERVICES LTD-SAL FOR ${MON[i]} 2026`, 54000)],
  },
  {
    id: "Y3",
    who: "HDFC narration",
    expect: "yes",
    payee: /acme/i,
    monthly: 75000,
    rows: [...life(), ...credits((i) => `NEFT CR-HDFC0000001-ACME PRIVATE LIMITED-SALARY ${MON[i]}`, 75000, 1)],
  },
  {
    id: "Y4",
    who: "ICICI narration",
    expect: "yes",
    payee: /wipro/i,
    monthly: 58000,
    rows: [...life(), ...credits("NEFT-ICIC0000104-WIPRO LIMITED-SALARY CREDIT", 58000, 28)],
  },
  {
    id: "Y5",
    who: "Axis bulk salary credit",
    expect: "yes",
    payee: /hcl/i,
    monthly: 47000,
    rows: [...life(), ...credits("BULK SALARY CREDIT HCL TECHNOLOGIES LTD", 47000, 30)],
  },
  {
    id: "Y6",
    who: "PNB NEFT",
    expect: "yes",
    payee: /bharat/i,
    monthly: 39000,
    rows: [...life(), ...credits("NEFT_IN:N123456:BHARAT ELECTRONICS LTD:SALARY", 39000, 1)],
  },
  {
    id: "Y7",
    who: "joined mid-month: first salary half",
    expect: "yes",
    payee: /zomato/i,
    monthly: 62000,
    rows: [...life(), ...credits("NEFT/CR/ZOMATO LTD/SALARY", [31000, 62000, 62000, 62000, 62000])],
  },
  {
    id: "Y8",
    who: "sales job, incentives swing the pay",
    expect: "yes",
    payee: /bajaj/i,
    rows: [...life(), ...credits("NEFT/CR/BAJAJ FINSERV LTD/SAL", [50000, 66000, 48000, 72000, 55000])],
  },
  {
    id: "Y9",
    who: "salary + a bonus month",
    expect: "yes",
    payee: /wipro/i,
    monthly: 70000,
    rows: [...life(), ...credits("NEFT/CR/WIPRO LTD/SALARY", 70000), row("2026-07-15", "NEFT/CR/WIPRO LTD/BONUS", 40000, "credit")],
  },
  {
    id: "Y10",
    who: "salary raised mid-year",
    expect: "yes",
    payee: /infosys/i,
    monthly: 68000,
    rows: [...life(), ...credits("NEFT/CR/INFOSYS LTD/SALARY", [62000, 62000, 68000, 68000, 68000])],
  },
  {
    id: "Y11",
    who: "paid on the 1st some months, the 30th others",
    expect: "yes",
    payee: /hcl/i,
    rows: [
      ...life(),
      ...["2026-05-01", "2026-05-30", "2026-07-01", "2026-07-31", "2026-09-01"].map((d) => row(d, "NEFT/CR/HCL TECHNOLOGIES/SALARY", 45000, "credit")),
    ],
  },
  {
    id: "Y12",
    who: "payroll provider",
    expect: "yes",
    payee: /razorpay|acme/i,
    monthly: 40000,
    rows: [...life(), ...credits("NEFT CR RAZORPAYX PAYROLL ACME", 40000)],
  },
  { id: "Y13", who: "central government, pay office", expect: "yes", monthly: 58000, rows: [...life(), ...credits("NEFT CR PAO CENTRAL GOVT PAY", 58000, 1)] },
  {
    id: "Y14",
    who: "state government treasury",
    expect: "yes",
    monthly: 41000,
    rows: [...life(), ...credits("BY TRANSFER-TREASURY OFFICE LUCKNOW-SAL", 41000, 1)],
  },
  { id: "Y15", who: "stipend (intern)", expect: "yes", monthly: 15000, rows: [...life(), ...credits("NEFT CR ACME LABS PVT LTD STIPEND", 15000, 5)] },
  {
    id: "Y16",
    who: "shop assistant, owner's UPI with note salary",
    expect: "yes",
    monthly: 18000,
    rows: [...life(), ...credits("UPI/CR/123/RAMESH KUMAR/SBIN/salary", 18000, 1)],
  },
  {
    id: "Y17",
    who: "salary + a bigger monthly fund payout",
    expect: "yes",
    payee: /infosys/i,
    monthly: 40000,
    rows: [...life(), ...credits("NEFT/CR/INFOSYS LTD/SALARY", 40000), ...credits("NEFT CR HDFC MUTUAL FUND SWP", 60000, 10)],
  },
  {
    id: "Y18",
    who: "salary + rent from a company tenant",
    expect: "yes",
    payee: /infosys/i,
    monthly: 40000,
    rows: [...life(), ...credits("NEFT/CR/INFOSYS LTD/SALARY", 40000), ...credits("NEFT CR SHARMA ENTERPRISES RENT", 45000, 5)],
  },
  {
    id: "Y19",
    who: "salary + own transfer from another bank",
    expect: "yes",
    payee: /infosys/i,
    ownNames: ["Aaditya", "Pandey"],
    rows: [...life(), ...credits("NEFT/CR/INFOSYS LTD/SALARY", 62000), ...credits("IMPS/CR/STATE BANK OF INDIA/AADITYA PANDEY", 20000, 2)],
  },
  {
    id: "Y20",
    who: "salary in the only month uploaded",
    expect: "ask",
    payee: /infosys/i,
    monthly: 62000,
    rows: [row("2026-09-04", "UPI/DR/1/SWIGGY", 340, "debit"), row("2026-09-30", "NEFT/CR/INFOSYS LTD/SALARY SEP", 62000, "credit")],
  },

  // Could be a salary, the narration does not say: Horizon should ask.
  {
    id: "A1",
    who: "SBI style, company, no word salary",
    expect: "ask",
    payee: /acme/i,
    monthly: 48000,
    rows: [...life(), ...credits("BY TRANSFER-NEFT*HDFC0000240*N1234*ACME TECHNOLOGIES PV--", 48000)],
  },
  {
    id: "A2",
    who: "steady NEFT from a company, nothing else",
    expect: "ask",
    payee: /globex/i,
    monthly: 35000,
    rows: [...life(), ...credits("NEFT CR GLOBEX SOLUTIONS PVT LTD", 35000, 28)],
  },
  {
    id: "A3",
    who: "family firm sends a steady monthly sum",
    expect: "ask",
    payee: /pandey/i,
    rows: [...life(), ...credits("NEFT CR PANDEY TRADERS", 10000, 5)],
  },
  {
    id: "A4",
    who: "freelancer on a monthly retainer",
    expect: "ask",
    payee: /bright/i,
    rows: [...life(), ...credits("NEFT CR BRIGHT DESIGNS PVT LTD", 30000, 7)],
  },

  // Not a salary.
  { id: "N1", who: "student, pocket money from a parent", expect: "no", rows: [...life(), ...credits("UPI/CR/1/RAJESH SHARMA/SBIN/r@oksbi", 8000, 1)] },
  { id: "N2", who: "student, no money in", expect: "no", rows: [...life()] },
  {
    id: "N3",
    who: "freelancer, uneven client payments",
    expect: "no",
    rows: [
      ...life(),
      ...credits("NEFT CR BRIGHT DESIGNS PVT LTD", [20000, 0, 45000, 0, 30000], 15),
      ...credits("UPI/CR/CLIENT TWO/okicici", [0, 12000, 0, 8000, 0], 20),
    ],
  },
  { id: "N4", who: "homemaker, spouse sends money monthly", expect: "no", rows: [...life(), ...credits("IMPS/CR/VIKRAM SINGH/HDFC", 25000, 2)] },
  { id: "N5", who: "retired, monthly pension", expect: "no", rows: [...life(), ...credits("NEFT CR SBI PENSION PAYMENT", 30000, 1)] },
  { id: "N6", who: "landlord, rent from a company tenant", expect: "no", rows: [...life(), ...credits("NEFT CR SHARMA ENTERPRISES RENT", 25000, 5)] },
  { id: "N7", who: "investor, monthly mutual fund SWP", expect: "no", rows: [...life(), ...credits("NEFT CR HDFC MUTUAL FUND SWP", 10000, 10)] },
  { id: "N8", who: "broker payout every month", expect: "no", rows: [...life(), ...credits("NEFT CR ZERODHA BROKING LTD", 15000, 12)] },
  {
    id: "N9",
    who: "own transfer from another bank",
    expect: "no",
    ownNames: ["Aaditya", "Pandey"],
    rows: [...life(), ...credits("IMPS/CR/STATE BANK OF INDIA/AADITYA PANDEY", 20000, 2)],
  },
  { id: "N10", who: "own transfer worded SELF", expect: "no", rows: [...life(), ...credits("IMPS/CR/SELF TRANSFER/HDFC BANK", 15000, 2)] },
  { id: "N11", who: "monthly cashback", expect: "no", rows: [...life(), ...credits("UPI/CR/AMAZON PAY CASHBACK", 400, 12)] },
  { id: "N12", who: "savings interest each quarter", expect: "no", rows: [...life(), ...credits("CREDIT INTEREST CAPITALISED", 900, 30)] },
  { id: "N13", who: "refunds from a shop", expect: "no", rows: [...life(), ...credits("UPI/CR/FLIPKART REFUND", 1500, 9)] },
  { id: "N14", who: "loan disbursal once", expect: "no", rows: [...life(), row("2026-07-03", "NEFT CR BAJAJ FINANCE LTD LOAN DISBURSAL", 200000, "credit")] },
  { id: "N15", who: "spending only: subscriptions, EMI, rent", expect: "no", rows: [...life()] },
  {
    id: "N16",
    who: "a one-off payment from a company",
    expect: "no",
    rows: [...life(), row("2026-08-14", "NEFT CR GLOBEX SOLUTIONS PVT LTD", 35000, "credit")],
  },
];
