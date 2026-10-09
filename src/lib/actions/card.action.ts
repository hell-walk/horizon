"use server";

import { revalidatePath } from "next/cache";

import { invalidate } from "../cache";
import { isKnownDesign } from "../cardDesigns";
import { createAdminClient } from "../server/appwrite";
import { getLoggedInUser } from "./user.action";

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID } = process.env;

/** Saves the card design for one of the signed-in user's accounts. */
export async function setCardDesign({ appwriteItemId, design }: { appwriteItemId: string; design: string }) {
  if (!isKnownDesign(design)) return { ok: false as const, error: "Unknown card design." };

  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: "You need to be signed in." };

  try {
    const { database } = await createAdminClient();
    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId);
    if (bank.userId !== user.$id) return { ok: false as const, error: "That account is not yours." };

    await database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, appwriteItemId, { cardDesign: design });
    invalidate("banks:");
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    console.error("[card] could not save the design", error);
    return { ok: false as const, error: "Could not save the design. Please try again." };
  }
}
