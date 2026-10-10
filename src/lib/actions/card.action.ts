"use server";

import { Query } from "node-appwrite";
import { revalidatePath } from "next/cache";

import { invalidate } from "../cache";
import { isKnownDesign } from "../cardDesigns";
import { getT } from "../i18n/server";
import { changeBlocked, countChange } from "../server/plan";
import { createAdminClient } from "../server/appwrite";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { allow, MINUTE } from "../server/rateLimit";
import { logError } from "../server/log";

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID } = process.env;

/** Saves the card design for one of the signed-in user's accounts. */
export async function setCardDesign({ appwriteItemId, design }: { appwriteItemId: string; design: string }) {
  const t = await getT();
  if (!isKnownDesign(design)) return { ok: false as const, error: t("connect.cardUnknownDesign") };

  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (!(await allow(`card:${ownerIdOf(user)}`, 60, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  const blocked = await changeBlocked(t);
  if (blocked) return { ok: false as const, error: blocked };

  try {
    const { database } = await createAdminClient();
    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId);
    if (bank.userId !== ownerIdOf(user)) return { ok: false as const, error: t("connect.cardNotYours") };

    await database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId, { cardDesign: design });
    invalidate("banks:");
    await countChange();
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    logError("card: could not save the design", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}

/**
 * Adds the last 4 digits to one of the signed-in user's imported accounts whose
 * statement did not show them (saved as "0000"). Only then: a known number
 * stays as it is, because later statements are matched to the account by it.
 */
export async function setAccountDigits({ appwriteItemId, digits }: { appwriteItemId: string; digits: string }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  const clean = typeof digits === "string" ? digits.trim() : "";
  if (!/^\d{4}$/.test(clean) || clean === "0000") return { ok: false as const, error: t("banks.digitsInvalid") };
  if (!(await allow(`digits:${ownerIdOf(user)}`, 20, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };

  try {
    const { database } = await createAdminClient();
    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, String(appwriteItemId ?? ""));
    if (bank.userId !== ownerIdOf(user)) return { ok: false as const, error: t("connect.cardNotYours") };
    if (bank.provider !== "manual" || (bank.accountMask && bank.accountMask !== "0000")) return { ok: false as const, error: t("banks.digitsAlreadySet") };
    // Two imported accounts at one bank with the same digits would be indistinguishable.
    const twin = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
      Query.equal("userId", [ownerIdOf(user)]),
      Query.equal("provider", ["manual"]),
      Query.equal("institutionName", [String(bank.institutionName ?? "")]),
      Query.equal("accountMask", [clean]),
    ]);
    if (twin.total > 0) return { ok: false as const, error: t("banks.digitsTaken") };

    await database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bank.$id, { accountMask: clean });
    invalidate("banks:");
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    logError("bank: could not save the last 4 digits", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
