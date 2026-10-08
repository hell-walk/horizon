"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { encryptId, parseStringify } from "../utils";
import { invalidate } from "../cache";
import {
  consentDataRange,
  createConsent,
  createDataSession,
  getConsent,
  isSetuConfigured,
  SETU_PROVIDER,
} from "../providers/setu";
import { createBankAccount } from "./user.action";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

// Remembers which consent the user started, in case Setu's redirect back does not
// carry the consent id in the query string.
const PENDING_CONSENT_COOKIE = "setu-consent";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Step 1 of linking an Indian bank: create a consent request for the customer's
 * mobile number and hand back the approval URL to redirect them to.
 */
export const createSetuConsent = async ({ mobile }: { mobile: string }) => {
  if (!isSetuConfigured()) {
    return { error: "Setu is not configured on this server yet." };
  }

  const vua = mobile.trim();
  // A bare 10-digit Indian mobile, or mobile@aa-handle.
  if (!/^\d{10}(@[a-z0-9-]+)?$/i.test(vua)) {
    return { error: "Enter a 10-digit mobile number, optionally followed by @aa-handle." };
  }

  try {
    const consent = await createConsent({ mobile: vua, redirectUrl: `${siteUrl()}/setu/callback` });

    (await cookies()).set(PENDING_CONSENT_COOKIE, consent.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 30,
    });

    return parseStringify({ consentId: consent.id, url: consent.url });
  } catch (error) {
    console.error("[setu] createConsent failed", error);
    return { error: error instanceof Error ? error.message : "Could not start the Setu consent." };
  }
};

/**
 * Step 2, after the customer returns from the AA: confirm the consent is ACTIVE,
 * store one bank row per linked account, and start a data session so the home
 * page has data ready.
 */
export const completeSetuConsent = async ({
  consentId,
  user,
}: {
  consentId?: string;
  user: User;
}) => {
  const cookieStore = await cookies();
  const id = consentId || cookieStore.get(PENDING_CONSENT_COOKIE)?.value;
  if (!id) return { status: "MISSING" as const, added: 0 };

  try {
    const consent = await getConsent(id);
    if (consent.status !== "ACTIVE") {
      return { status: consent.status, added: 0 };
    }

    const accounts = (consent.detail?.accounts ?? []).filter(
      (account) => !account.fiType || account.fiType.toUpperCase() === "DEPOSIT"
    );

    const { database } = await createAdminClient();
    const existing = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
      Query.equal("userId", [user.$id]),
      Query.equal("provider", [SETU_PROVIDER]),
    ]);
    const known = new Set(existing.documents.map((bank) => bank.accountId as string));

    // Kick off a data session now so the first page load does not have to wait for it.
    let dataSessionId: string | undefined;
    try {
      const session = await createDataSession(id, consentDataRange(consent));
      dataSessionId = session.id;
    } catch (error) {
      console.error("[setu] could not start the first data session", error);
    }

    let added = 0;
    for (const account of accounts) {
      if (known.has(account.linkRefNumber)) continue;

      await createBankAccount({
        userId: user.$id,
        bankId: id,
        accountId: account.linkRefNumber,
        accessToken: id,
        fundingSourceUrl: "",
        sharableId: encryptId(account.linkRefNumber),
        provider: SETU_PROVIDER,
        currency: "INR",
        dataSessionId,
      });
      added++;
    }

    cookieStore.delete(PENDING_CONSENT_COOKIE);
    invalidate("banks:");
    invalidate(`setu:session:${id}`);
    revalidatePath("/");

    return { status: "ACTIVE" as const, added, total: accounts.length };
  } catch (error) {
    console.error("[setu] completeSetuConsent failed", error);
    return { status: "ERROR" as const, added: 0, error: error instanceof Error ? error.message : String(error) };
  }
};

/** Remembers the latest data session for every bank row under a consent. */
export const saveSetuSessionId = async ({ consentId, sessionId }: { consentId: string; sessionId: string }) => {
  try {
    const { database } = await createAdminClient();
    const banks = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
      Query.equal("bankId", [consentId]),
    ]);
    await Promise.all(
      banks.documents.map((bank) =>
        database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bank.$id, { dataSessionId: sessionId })
      )
    );
    invalidate("banks:");
  } catch (error) {
    console.error("[setu] could not persist the data session id", error);
  }
};
