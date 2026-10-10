import "server-only";

import { Query, type Models } from "node-appwrite";

import { invalidate } from "../cache";
import { plaidClient } from "../plaid";
import { createAdminClient } from "./appwrite";
import { authIdOf, ownerIdOf } from "./auth";
import { readCorrections } from "../corrections";
import { readGoals } from "../goals";
import { getBanks, getUserInfo } from "./banks";
import { deactivateCustomer, removeFundingSource } from "./dwolla";
import { logError } from "./log";

// What the privacy page offers: a copy of your data, removing a bank, and
// deleting the account. Server-only; the actions in actions/privacy.action.ts
// check who is asking first.

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
  APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID,
} = process.env;

type Doc = Models.Document & Record<string, unknown>;

/** Stand-in written where a deleted user's id or email appeared in someone else's transfer record. */
export const DELETED_USER = "deleted-user";

/** Every document matching the queries, page by page. */
async function listAll(collection: string, queries: string[]): Promise<Doc[]> {
  const { database } = await createAdminClient();
  const out: Doc[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const result = await database.listDocuments(DATABASE_ID!, collection, [Query.limit(100), ...queries, ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...(result.documents as Doc[]));
    if (result.documents.length < 100) break;
    cursor = result.documents[result.documents.length - 1].$id;
  }
  return out;
}

/** Deletes every document matching the queries; returns how many. */
async function deleteAll(collection: string, queries: string[]): Promise<number> {
  const { database } = await createAdminClient();
  const docs = await listAll(collection, queries);
  for (let i = 0; i < docs.length; i += 10) {
    await Promise.all(docs.slice(i, i + 10).map((d) => database.deleteDocument(DATABASE_ID!, collection, d.$id)));
  }
  return docs.length;
}

/**
 * Removes one bank: cuts the provider's link (Plaid item, Dwolla funding
 * source), deletes its imported statement rows, then the bank row itself.
 * Transfer records stay: they are also the other person's history.
 */
export async function removeBank(bank: Bank): Promise<{ statements: number }> {
  if ((!bank.provider || bank.provider === "plaid") && bank.accessToken && bank.accessToken.startsWith("access-")) {
    try {
      await plaidClient.itemRemove({ access_token: bank.accessToken });
    } catch (error) {
      logError("privacy: Plaid item removal failed", error);
    }
  }
  if (bank.fundingSourceUrl) await removeFundingSource(bank.fundingSourceUrl);

  const statements = await deleteAll(STATEMENT_COLLECTION_ID!, [Query.equal("bankId", [bank.$id])]);
  const { database } = await createAdminClient();
  await database.deleteDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bank.$id);
  invalidate("banks:");
  invalidate(`statement:${bank.$id}`);
  return { statements };
}

/** Everything Horizon holds about the user, without secrets or internal links. */
export async function exportUserData(user: User) {
  const owner = ownerIdOf(user);
  const profile = await getUserInfo({ userId: authIdOf(user) });
  const banks = await getBanks({ userId: owner });
  const [sent, received] = await Promise.all([
    listAll(TRANSACTION_COLLECTION_ID!, [Query.equal("senderId", [owner])]),
    listAll(TRANSACTION_COLLECTION_ID!, [Query.equal("receiverId", [owner])]),
  ]);
  const { user: users } = await createAdminClient();
  const prefs = await users.getPrefs(authIdOf(user)).catch(() => ({}) as Record<string, unknown>);

  const accounts = [];
  for (const bank of banks) {
    const rows = await listAll(STATEMENT_COLLECTION_ID!, [Query.equal("bankId", [bank.$id])]);
    accounts.push({
      bank: bank.institutionName ?? null,
      lastFourDigits: bank.accountMask ?? null,
      connectedWith: bank.provider ?? "plaid",
      currency: bank.currency ?? null,
      balance: bank.currentBalance ?? null,
      addedAt: (bank as Bank & { $createdAt?: string }).$createdAt ?? null,
      statementEntries: rows.map((r) => ({
        date: r.date,
        description: r.name,
        amount: r.amount,
        direction: r.type === "credit" ? "money in" : "money out",
        category: r.category ?? null,
        balance: r.balance ?? null,
        reference: r.reference ?? null,
      })),
    });
  }

  const transfer = (t: Doc, direction: "sent" | "received") => ({
    direction,
    amount: t.amount,
    note: t.name,
    recipientEmail: t.email,
    at: t.$createdAt,
  });

  return {
    exportedAt: new Date().toISOString(),
    about:
      "Everything Horizon stores about you. Bank access tokens and payment-provider links are left out: they are keys, not information about you.",
    profile: {
      email: user.email,
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      address: profile ? { line1: profile.address1, city: profile.city, state: profile.state, postalCode: profile.postalCode } : null,
      createdAt: profile?.$createdAt ?? null,
    },
    accounts,
    transfers: [...sent.map((t) => transfer(t, "sent")), ...received.map((t) => transfer(t, "received"))],
    savedStatementLayouts: (prefs as Record<string, unknown>).statementLayouts ?? {},
    yourChanges: readCorrections((prefs as Record<string, unknown>).corrections),
    savingsGoals: readGoals((prefs as Record<string, unknown>).goals),
    country: typeof (prefs as Record<string, unknown>).country === "string" ? (prefs as Record<string, unknown>).country : undefined,
  };
}

/**
 * Deletes the account: every bank (with its statements and provider links),
 * the user's side of transfer records (anonymised, since the other person
 * keeps their own history), the payments customer (deactivated: Dwolla never
 * deletes), the profile and the login itself, which ends every session.
 */
export async function deleteUserEverything(user: User) {
  const owner = ownerIdOf(user);
  const authId = authIdOf(user);
  const { database, user: users } = await createAdminClient();

  for (const bank of await getBanks({ userId: owner })) await removeBank(bank);

  for (const [field, extra] of [
    ["senderId", {}],
    ["receiverId", { email: DELETED_USER }],
  ] as const) {
    for (const t of await listAll(TRANSACTION_COLLECTION_ID!, [Query.equal(field, [owner])])) {
      await database.updateDocument(DATABASE_ID!, TRANSACTION_COLLECTION_ID!, t.$id, { [field]: DELETED_USER, ...extra });
    }
  }

  const profile = await getUserInfo({ userId: authId });
  if (profile?.dwollaCustomerUrl) await deactivateCustomer(profile.dwollaCustomerUrl);
  if (profile?.$id) await database.deleteDocument(DATABASE_ID!, USER_COLLECTION_ID!, profile.$id);

  await users.delete(authId); // the login, its sessions and preferences
  invalidate("banks:");
}
