// Banks offered in the guided statement import, with the usual password of
// their statement PDFs. The texts live in the "connect" messages
// (connect.guidePassword_<id>), so they are translated like everything else.
//
// Checked 10 Oct 2026. HDFC's rule (numeric Customer ID) is from HDFC's own
// help pages; the others are the formats most guides agree on, so the app
// says "usually" and always points to the bank's email first. Re-check these
// now and then: banks change them.

export const STATEMENT_BANKS = [
  { id: "sbi", name: "State Bank of India" },
  { id: "hdfc", name: "HDFC Bank" },
  { id: "icici", name: "ICICI Bank" },
  { id: "axis", name: "Axis Bank" },
  { id: "kotak", name: "Kotak Mahindra Bank" },
  { id: "pnb", name: "Punjab National Bank" },
] as const;

export type StatementBankId = (typeof STATEMENT_BANKS)[number]["id"] | "other";
