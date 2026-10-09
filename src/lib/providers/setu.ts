// Setu Account Aggregator (AA) adapter.
//
// Setu is the Indian counterpart of Plaid, built on the RBI's Account Aggregator
// framework. The flow is consent based rather than credential based:
//   1. createConsent()  -> Setu returns a URL where the customer approves sharing
//   2. the customer is redirected back to our /setu/callback page
//   3. getConsent()     -> status ACTIVE, with the accounts the customer linked
//   4. createDataSession() + getDataSession() -> balances and transactions
//
// Docs: https://docs.setu.co/data/account-aggregator

import { cached, TTL } from "../cache";

const BASE_URL = process.env.SETU_BASE_URL ?? "https://fiu-sandbox.setu.co";

// How far back we ask for transactions when a consent is created.
const CONSENT_MONTHS_BACK = 12;
// How long the consent stays valid; sessions can be created until then.
const CONSENT_MONTHS_VALID = 12;

export const SETU_PROVIDER = "setu" as const;

/* ------------------------------------------------------------------ */
/* Types for the parts of Setu's responses we rely on                  */
/* ------------------------------------------------------------------ */

export type SetuConsentStatus =
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "REVOKED"
  | "PAUSED"
  | "EXPIRED"
  | "FAILED";

export type SetuConsentAccount = {
  maskedAccNumber: string;
  accType?: string; // SAVINGS, CURRENT
  fipId: string;
  fiType?: string; // DEPOSIT, ...
  linkRefNumber: string;
};

export type SetuConsent = {
  id: string;
  url?: string;
  status: SetuConsentStatus;
  dataRange?: { from: string; to: string };
  detail?: {
    accounts?: SetuConsentAccount[];
    FIDataRange?: { from: string; to: string };
    DataRange?: { from: string; to: string };
    [key: string]: unknown;
  };
};

export type SetuSessionStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "EXPIRED" | "FAILED";

export type SetuTransaction = {
  txnId: string;
  amount: string | number;
  narration?: string;
  type: "CREDIT" | "DEBIT";
  mode?: string; // UPI, ATM, CARD, OTHERS ...
  currentBalance?: string | number;
  transactionTimestamp: string;
  valueDate?: string;
  reference?: string;
};

export type SetuSessionAccount = {
  linkRefNumber: string;
  maskedAccNumber?: string;
  status?: string;
  FIstatus?: string;
  FIStatus?: string;
  data?: {
    account?: {
      linkedAccRef?: string;
      maskedAccNumber?: string;
      type?: string;
      profile?: {
        holders?: {
          type?: string;
          holder?: { name?: string } | { name?: string }[];
        };
      };
      summary?: {
        currentBalance?: string | number;
        currency?: string;
        type?: string;
        branch?: string;
        ifscCode?: string;
        balanceDateTime?: string;
        status?: string;
      };
      transactions?:
        | { startDate?: string; endDate?: string; transaction?: SetuTransaction[] }
        | SetuTransaction[];
    };
  };
};

export type SetuSession = {
  id: string;
  consentId: string;
  status: SetuSessionStatus;
  format?: string;
  dataRange?: { from: string; to: string };
  fips?: { fipID: string; accounts: SetuSessionAccount[] }[] | null;
};

/* ------------------------------------------------------------------ */
/* HTTP client                                                         */
/* ------------------------------------------------------------------ */

export function isSetuConfigured() {
  return Boolean(
    process.env.SETU_CLIENT_ID && process.env.SETU_CLIENT_SECRET && process.env.SETU_PRODUCT_INSTANCE_ID
  );
}

function authHeaders() {
  const { SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_INSTANCE_ID } = process.env;
  if (!SETU_CLIENT_ID || !SETU_CLIENT_SECRET || !SETU_PRODUCT_INSTANCE_ID) {
    throw new Error(
      "Setu is not configured. Set SETU_CLIENT_ID, SETU_CLIENT_SECRET and SETU_PRODUCT_INSTANCE_ID in .env"
    );
  }
  return {
    "Content-Type": "application/json",
    "x-client-id": SETU_CLIENT_ID,
    "x-client-secret": SETU_CLIENT_SECRET,
    "x-product-instance-id": SETU_PRODUCT_INSTANCE_ID,
  };
}

async function setuRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
    cache: "no-store",
    // Fail fast instead of hanging a page render if Setu is unreachable.
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const detail = (body as { errorMsg?: string; message?: string; errorCode?: string }) ?? {};
    throw new Error(
      `Setu ${init.method ?? "GET"} ${path} failed (${response.status}): ${
        detail.errorMsg ?? detail.message ?? detail.errorCode ?? text.slice(0, 200)
      }`
    );
  }

  return body as T;
}

/* ------------------------------------------------------------------ */
/* Consent flow                                                        */
/* ------------------------------------------------------------------ */

/**
 * Starts a consent request. `mobile` is the customer's number; an AA handle may
 * be appended ("9999999999@onemoney") to force a specific aggregator. Without a
 * handle Setu picks the best performing AA for that customer.
 */
export async function createConsent({ mobile, redirectUrl }: { mobile: string; redirectUrl: string }) {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - CONSENT_MONTHS_BACK);
  const to = new Date(now);
  to.setMonth(to.getMonth() + CONSENT_MONTHS_VALID);

  return setuRequest<SetuConsent>("/consents", {
    method: "POST",
    body: JSON.stringify({
      consentDuration: { unit: "MONTH", value: String(CONSENT_MONTHS_VALID) },
      vua: mobile,
      dataRange: { from: from.toISOString(), to: to.toISOString() },
      context: [],
      redirectUrl,
    }),
  });
}

export async function getConsent(consentId: string) {
  return setuRequest<SetuConsent>(`/consents/${consentId}?expanded=true`);
}

/** The window a data session may ask for: the consent's own range, else a safe default. */
export function consentDataRange(consent: SetuConsent) {
  const range = consent.dataRange ?? consent.detail?.FIDataRange ?? consent.detail?.DataRange;
  if (range?.from && range?.to) {
    // Setu rejects sessions that reach into the future, so cap `to` at now.
    const to = new Date(range.to) > new Date() ? new Date().toISOString() : range.to;
    return { from: range.from, to };
  }
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - CONSENT_MONTHS_BACK);
  return { from: from.toISOString(), to: to.toISOString() };
}

/* ------------------------------------------------------------------ */
/* Data sessions                                                       */
/* ------------------------------------------------------------------ */

export async function createDataSession(consentId: string, range: { from: string; to: string }) {
  return setuRequest<SetuSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ consentId, dataRange: range, format: "json" }),
  });
}

export async function getDataSession(sessionId: string) {
  return setuRequest<SetuSession>(`/sessions/${sessionId}`);
}

const READY: SetuSessionStatus[] = ["COMPLETED", "PARTIAL"];

/** Polls a session until the FIPs have delivered data, or gives up after `timeoutMs`. */
export async function waitForDataSession(sessionId: string, timeoutMs = 20_000) {
  const started = Date.now();
  let session = await getDataSession(sessionId);

  while (!READY.includes(session.status) && session.status !== "FAILED" && session.status !== "EXPIRED") {
    if (Date.now() - started > timeoutMs) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    session = await getDataSession(sessionId);
  }

  return session;
}

/**
 * Returns a session with data for the consent, reusing `existingSessionId` when it
 * is still usable and creating a fresh one otherwise. Cached for a minute per consent
 * so several bank rows under one consent share a single Setu round trip.
 */
export async function loadSessionForConsent(
  consentId: string,
  existingSessionId?: string,
  onCreated?: (sessionId: string) => Promise<void>
) {
  return cached(`setu:session:${consentId}`, TTL.minute, async () => {
    if (existingSessionId) {
      try {
        const existing = await getDataSession(existingSessionId);
        if (READY.includes(existing.status)) return existing;
      } catch {
        // fall through and create a new session
      }
    }

    const consent = await getConsent(consentId);
    if (consent.status !== "ACTIVE") {
      throw new Error(`Setu consent ${consentId} is ${consent.status}, not ACTIVE`);
    }

    const created = await createDataSession(consentId, consentDataRange(consent));
    // Remember the session before waiting so a slow FIP does not cause a second session next time.
    await onCreated?.(created.id);

    const session = await waitForDataSession(created.id);
    if (!READY.includes(session.status)) {
      // Throwing keeps the pending result out of the cache; the next request retries.
      throw new Error(`Setu data session ${session.id} is ${session.status}`);
    }
    return session;
  });
}

/* ------------------------------------------------------------------ */
/* Normalisation into the app's own shapes                             */
/* ------------------------------------------------------------------ */

export function institutionName(fipId: string) {
  return fipId
    .replace(/[-_]+/g, " ")
    .replace(/\bfip\b/i, "FIP")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findSessionAccount(session: SetuSession, linkRefNumber: string) {
  for (const fip of session.fips ?? []) {
    const account = fip.accounts?.find(
      (a) => a.linkRefNumber === linkRefNumber || a.data?.account?.linkedAccRef === linkRefNumber
    );
    if (account) return { fipId: fip.fipID, account };
  }
  return null;
}

const toNumber = (value: string | number | undefined) => {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

const maskOf = (masked?: string) => (masked ? masked.replace(/\D/g, "").slice(-4) || "0000" : "0000");

/** Maps a Setu account into the app's Account shape used by every component. */
export function toAccount({
  fipId,
  account,
  bank,
}: {
  fipId: string;
  account: SetuSessionAccount;
  bank: Bank;
}): Account {
  const data = account.data?.account;
  const summary = data?.summary ?? {};
  const balance = toNumber(summary.currentBalance);
  const subtype = (summary.type ?? "savings").toLowerCase();

  return {
    id: account.linkRefNumber,
    availableBalance: balance,
    currentBalance: balance,
    institutionId: fipId,
    name: `${institutionName(fipId)} ${subtype === "current" ? "Current" : "Savings"}`,
    officialName: `${institutionName(fipId)} ${summary.type ?? "SAVINGS"} ${summary.branch ? `(${summary.branch})` : ""}`.trim(),
    mask: maskOf(data?.maskedAccNumber ?? account.maskedAccNumber),
    type: "depository",
    subtype,
    appwriteItemId: bank.$id,
    sharableId: bank.sharableId,
    currency: summary.currency ?? bank.currency ?? "INR",
    provider: SETU_PROVIDER,
    cardDesign: bank.cardDesign,
  };
}

/** Maps Setu transactions into the app's Transaction shape (same fields Plaid produces). */
export function toTransactions(account: SetuSessionAccount, currency: string) {
  const raw = account.data?.account?.transactions;
  const list: SetuTransaction[] = Array.isArray(raw) ? raw : raw?.transaction ?? [];

  return list.map((t) => ({
    id: t.txnId,
    name: t.narration?.trim() || t.reference || t.mode || "Transaction",
    paymentChannel: (t.mode ?? "other").toLowerCase(),
    type: t.type === "DEBIT" ? "debit" : "credit",
    accountId: account.linkRefNumber,
    amount: Math.abs(toNumber(t.amount)),
    pending: false,
    category: categoryFor(t),
    date: t.transactionTimestamp ?? t.valueDate ?? "",
    image: "",
    currency,
  }));
}

// Setu does not categorise transactions; derive a coarse category from the payment mode.
function categoryFor(t: SetuTransaction) {
  const mode = (t.mode ?? "").toUpperCase();
  if (mode === "UPI" || mode === "CARD") return "Payment";
  if (mode === "ATM" || mode === "CASH") return "Cash";
  if (/NEFT|IMPS|RTGS|FT|TRANSFER/.test(mode)) return "Transfer";
  if (/SALARY|INTEREST|INT\b/i.test(t.narration ?? "")) return "Income";
  return "Transfer";
}
