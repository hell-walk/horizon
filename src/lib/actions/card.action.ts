"use server";

import { revalidatePath } from "next/cache";

import { invalidate } from "../cache";
import { isKnownDesign } from "../cardDesigns";
import { getT } from "../i18n/server";
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
  if (!allow(`card:${ownerIdOf(user)}`, 60, 10 * MINUTE)) return { ok: false as const, error: t("connect.cardTooMany") };

  try {
    const { database } = await createAdminClient();
    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId);
    if (bank.userId !== ownerIdOf(user)) return { ok: false as const, error: t("connect.cardNotYours") };

    await database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId, { cardDesign: design });
    invalidate("banks:");
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    logError("card: could not save the design", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
