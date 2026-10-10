"use server";

import { revalidatePath } from "next/cache";

import { requireUser, NotSignedInError } from "../server/auth";
import { getBankBySharableId, getOwnBank } from "../server/banks";
import { createTransfer } from "../server/dwolla";
import { allow, MINUTE } from "../server/rateLimit";
import { createTransaction } from "../server/transactions";

export type TransferInput = { senderBank: string; sharableId: string; amount: string; name: string; email: string };
export type TransferResult = { ok: true } | { ok: false; field?: keyof TransferInput; error: string };

const MAX_TRANSFER = 10_000; // per transfer, in the account currency
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends money from one of the signed-in user's accounts to the account behind a
 * sharable id. Everything is checked here, on the server: who is sending, that
 * the source account is theirs, and the amount.
 */
export async function sendTransfer(input: TransferInput): Promise<TransferResult> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof NotSignedInError) return { ok: false, error: error.message };
    throw error;
  }
  if (!allow(`transfer:${user.$id}`, 10, 10 * MINUTE)) {
    return { ok: false, error: "Too many transfers in a short time. Wait a few minutes and try again." };
  }

  const amount = String(input?.amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return { ok: false, field: "amount", error: "Enter an amount greater than zero, with at most two decimals." };
  }
  if (Number(amount) > MAX_TRANSFER) return { ok: false, field: "amount", error: `Transfers are limited to ${MAX_TRANSFER.toLocaleString()} at a time.` };
  const name = String(input?.name ?? "").trim().slice(0, 140);
  if (name.length < 4) return { ok: false, field: "name", error: "Add a short note (at least 4 characters)." };
  const email = String(input?.email ?? "").trim().slice(0, 254);
  if (!EMAIL.test(email)) return { ok: false, field: "email", error: "Enter a valid email address." };

  const senderBank = await getOwnBank(user.$id, String(input?.senderBank ?? ""));
  if (!senderBank?.fundingSourceUrl) {
    return { ok: false, field: "senderBank", error: "This account cannot send transfers. Choose a Plaid-linked US account." };
  }

  const receiverBank = await getBankBySharableId(String(input?.sharableId ?? "").trim());
  if (!receiverBank?.fundingSourceUrl) {
    return {
      ok: false,
      field: "sharableId",
      error: "This account cannot receive transfers yet. Only Plaid-linked US accounts are supported.",
    };
  }
  if (receiverBank.$id === senderBank.$id) return { ok: false, field: "sharableId", error: "Choose a different account to send to." };

  const transfer = await createTransfer({
    sourceFundingSourceUrl: senderBank.fundingSourceUrl,
    destinationFundingSourceUrl: receiverBank.fundingSourceUrl,
    amount,
  });
  if (!transfer) return { ok: false, error: "The transfer was declined by the payment network. Check the amount and try again." };

  await createTransaction({
    name,
    amount,
    senderId: senderBank.userId,
    senderBankId: senderBank.$id,
    receiverId: receiverBank.userId,
    receiverBankId: receiverBank.$id,
    email,
  });

  revalidatePath("/");
  return { ok: true };
}
