import "server-only";

import { ID, Query } from "node-appwrite";

import { cached, invalidate, TTL } from "../cache";
import { parseStringify } from "../utils";
import { createAdminClient } from "./appwrite";
import { openSecret, sealSecret } from "./crypto";
import { forgetLeftOver } from "./leftover";
import { logError } from "./log";

// Data access for users and banks. Server-only on purpose: none of these check
// who is asking, so they must never be exported from a "use server" file (that
// would make each one a public endpoint). Actions check the session first.

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

/** Bank rows come back with their access token opened. */
const withOpenToken = (bank: Bank): Bank => ({ ...bank, accessToken: openSecret(bank.accessToken) });

export async function getUserInfo({ userId }: getUserInfoProps) {
  try {
    const { database } = await createAdminClient();
    const user = await database.listDocuments(DATABASE_ID!, USER_COLLECTION_ID!, [Query.equal("userId", [userId])]);
    const info = user.documents[0];
    return info ? parseStringify(info) : null;
  } catch (error) {
    logError("Error fetching user info", error);
    return null;
  }
}

export async function getBanks({ userId }: getBanksProps): Promise<Bank[]> {
  try {
    const banks = await cached(`banks:${userId}`, TTL.short, async () => {
      const { database } = await createAdminClient();
      const result = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [Query.equal("userId", [userId])]);
      return result.documents;
    });
    return (parseStringify(banks) as Bank[]).map(withOpenToken);
  } catch (error) {
    logError("Error fetching banks", error);
    return [];
  }
}

export async function getBank({ documentId }: getBankProps): Promise<Bank | null> {
  try {
    const { database } = await createAdminClient();
    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, documentId);
    return withOpenToken(parseStringify(bank));
  } catch {
    return null;
  }
}

/** The bank only if it belongs to this user; null otherwise, so callers cannot tell "not yours" from "missing". */
export async function getOwnBank(userId: string, documentId: string): Promise<Bank | null> {
  if (!documentId) return null;
  const bank = await getBank({ documentId });
  return bank && bank.userId === userId ? bank : null;
}

/** The account a sharable id points at, for receiving a transfer. */
export async function getBankBySharableId(sharableId: string): Promise<Bank | null> {
  try {
    const { database } = await createAdminClient();
    const result = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [Query.equal("sharableId", [sharableId])]);
    return result.total === 1 ? withOpenToken(parseStringify(result.documents[0])) : null;
  } catch (error) {
    logError("Error looking up a sharable id", error);
    return null;
  }
}

export async function createBankAccount({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  sharableId,
  provider = "plaid",
  currency,
  dataSessionId,
  institutionName,
  accountMask,
  currentBalance,
}: createBankAccountProps) {
  try {
    const { database } = await createAdminClient();
    const bankAccount = await database.createDocument(DATABASE_ID!, BANK_COLLECTION_ID!, ID.unique(), {
      userId,
      bankId,
      accountId,
      accessToken: sealSecret(accessToken),
      fundingSourceUrl: fundingSourceUrl ?? "",
      sharableId,
      provider,
      ...(currency ? { currency } : {}),
      ...(dataSessionId ? { dataSessionId } : {}),
      ...(institutionName ? { institutionName } : {}),
      ...(accountMask ? { accountMask } : {}),
      ...(currentBalance !== undefined ? { currentBalance } : {}),
    });
    invalidate("banks:");
    await forgetLeftOver(userId);
    return withOpenToken(parseStringify(bankAccount));
  } catch (error) {
    logError("An error occurred while creating the bank account", error);
  }
}

/** Remembers the latest Setu data session for every bank row under a consent. */
export async function saveSetuSessionId({ consentId, sessionId }: { consentId: string; sessionId: string }) {
  try {
    const { database } = await createAdminClient();
    const banks = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [Query.equal("bankId", [consentId])]);
    await Promise.all(
      banks.documents.map((bank) => database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bank.$id, { dataSessionId: sessionId }))
    );
    invalidate("banks:");
  } catch (error) {
    logError("setu: could not persist the data session id", error);
  }
}
