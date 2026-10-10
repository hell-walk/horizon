"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";

import { ownerIdOf, requireUser, NotSignedInError } from "../server/auth";
import { getBankBySharableId, getOwnBank } from "../server/banks";
import { createTransfer } from "../server/dwolla";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";
import { createTransaction } from "../server/transactions";

export type TransferInput = {
  senderBank: string;
  sharableId: string;
  amount: string;
  name: string;
  email: string;
  idempotencyKey: string; // made once per filled-in form, reused on every retry of it
};
export type TransferResult =
  | { ok: true; warning?: string }
  | { ok: false; field?: Exclude<keyof TransferInput, "idempotencyKey">; error: string };

const MAX_TRANSFER = 10_000; // per transfer, in USD
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The same form sent twice (double click, a retry after a slow network) must
// not become two transfers. Dwolla dedupes by Idempotency-Key; this also stops
// a second copy reaching Dwolla while the first is still in flight, and
// answers a repeat with the first result.
const inFlight = new Set<string>();
const finished = new Map<string, { result: TransferResult; at: number }>();
const REMEMBER_MS = 24 * 60 * MINUTE;

const remember = (key: string, result: TransferResult) => {
  const now = Date.now();
  for (const [k, v] of finished) if (now - v.at > REMEMBER_MS) finished.delete(k);
  finished.set(key, { result, at: now });
  return result;
};

/**
 * Sends money from one of the signed-in user's accounts to the account behind a
 * sharable id. Everything is checked here, on the server: who is sending, that
 * the source account is theirs, the currency and the amount.
 */
export async function sendTransfer(input: TransferInput): Promise<TransferResult> {
  const t = await getT();
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof NotSignedInError) return { ok: false, error: error.message };
    throw error;
  }

  const key = String(input?.idempotencyKey ?? "");
  if (!UUID.test(key)) return { ok: false, error: t("transfer.errReload") };
  const scopedKey = `${ownerIdOf(user)}:${key}`;
  const earlier = finished.get(scopedKey);
  if (earlier) return earlier.result;
  if (inFlight.has(scopedKey)) return { ok: false, error: t("transfer.errInFlight") };

  if (!allow(`transfer:${ownerIdOf(user)}`, 10, 10 * MINUTE)) {
    return { ok: false, error: t("transfer.errTooMany") };
  }

  const amount = String(input?.amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return { ok: false, field: "amount", error: t("transfer.errAmountFormat") };
  }
  if (Number(amount) > MAX_TRANSFER) return { ok: false, field: "amount", error: t("transfer.errAmountMax", { max: `$${MAX_TRANSFER.toLocaleString("en-US")}` }) };
  const name = String(input?.name ?? "").trim().slice(0, 140);
  if (name.length < 4) return { ok: false, field: "name", error: t("transfer.errNoteShort") };
  const email = String(input?.email ?? "").trim().slice(0, 254);
  if (!EMAIL.test(email)) return { ok: false, field: "email", error: t("transfer.errEmailInvalid") };

  // Transfers run on Dwolla, which only moves US dollars between Plaid-linked US accounts.
  const isUsdPlaid = (bank: Bank) => (!bank.provider || bank.provider === "plaid") && (!bank.currency || bank.currency === "USD");

  const senderBank = await getOwnBank(ownerIdOf(user), String(input?.senderBank ?? ""));
  if (!senderBank?.fundingSourceUrl || !isUsdPlaid(senderBank)) {
    return { ok: false, field: "senderBank", error: t("transfer.errSenderCannot") };
  }

  const receiverBank = await getBankBySharableId(String(input?.sharableId ?? "").trim());
  if (!receiverBank?.fundingSourceUrl || !isUsdPlaid(receiverBank)) {
    return {
      ok: false,
      field: "sharableId",
      error: t("transfer.errReceiverCannot"),
    };
  }
  if (receiverBank.$id === senderBank.$id) return { ok: false, field: "sharableId", error: t("transfer.errSameAccount") };

  inFlight.add(scopedKey);
  try {
    const transfer = await createTransfer({
      sourceFundingSourceUrl: senderBank.fundingSourceUrl,
      destinationFundingSourceUrl: receiverBank.fundingSourceUrl,
      amount,
      idempotencyKey: key,
    });
    // Declined is final for this key: the same form must not be retried as is.
    if (!transfer) return remember(scopedKey, { ok: false, error: t("transfer.errDeclined") });

    const record = await createTransaction({
      name,
      amount,
      senderId: senderBank.userId,
      senderBankId: senderBank.$id,
      receiverId: receiverBank.userId,
      receiverBankId: receiverBank.$id,
      email,
    });
    revalidatePath("/");

    if (!record) {
      // The money moved; only Horizon's copy is missing. Keep the Dwolla link in
      // the log so the record can be restored, and tell the user not to resend.
      logError(`transfer: sent but not recorded, dwolla=${transfer.split("/").pop()} sender=${senderBank.$id} receiver=${receiverBank.$id} amount=${amount}`);
      return remember(scopedKey, {
        ok: true,
        warning: t("transfer.warnNotSaved"),
      });
    }
    return remember(scopedKey, { ok: true });
  } finally {
    inFlight.delete(scopedKey);
  }
}
