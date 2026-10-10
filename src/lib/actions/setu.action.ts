"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";

import { getT } from "../i18n/server";
import { createAdminClient } from "../server/appwrite";
import { ownerIdOf, requireUser } from "../server/auth";
import { createBankAccount } from "../server/banks";
import { newSharableId, openSealed, sealSecret } from "../server/crypto";
import { allow, MINUTE } from "../server/rateLimit";
import { parseStringify } from "../utils";
import { invalidate } from "../cache";
import {
  consentDataRange,
  createConsent,
  createDataSession,
  getConsent,
  isSetuConfigured,
  SETU_PROVIDER,
} from "../providers/setu";
import { logError } from "../server/log";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

// Remembers which consent the user started, in case Setu's redirect back does not
// carry the consent id in the query string.
const PENDING_CONSENT_COOKIE = "setu-consent";

// The cookie holds who started the consent as well as which one, sealed so it can
// be neither read nor forged: on a shared browser, the next person to sign in
// must not be able to finish someone else's consent and get their accounts.
const pendingValue = (ownerId: string, consentId: string) => sealSecret(JSON.stringify({ ownerId, consentId }));
const readPending = (value: string | undefined): { ownerId: string; consentId: string } | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(openSealed(value)); // a hand-made, unsealed cookie is refused
    return typeof parsed?.ownerId === "string" && typeof parsed?.consentId === "string" ? parsed : null;
  } catch {
    return null;
  }
};

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Step 1 of linking an Indian bank: create a consent request for the customer's
 * mobile number and hand back the approval URL to redirect them to.
 */
export const createSetuConsent = async ({ mobile }: { mobile: string }) => {
  const t = await getT();
  const user = await requireUser().catch(() => null);
  if (!user) return { error: t("connect.errSignIn") };
  if (!(await allow(`setu:${ownerIdOf(user)}`, 5, 10 * MINUTE))) return { error: t("connect.setuTooMany") };

  if (!isSetuConfigured()) {
    return { error: t("connect.setuNotConfigured") };
  }

  const vua = String(mobile ?? "").trim();
  // A bare 10-digit Indian mobile, or mobile@aa-handle.
  if (!/^\d{10}(@[a-z0-9-]+)?$/i.test(vua)) {
    return { error: t("connect.setuMobileInvalid") };
  }

  try {
    const consent = await createConsent({ mobile: vua, redirectUrl: `${siteUrl()}/setu/callback` });

    (await cookies()).set(PENDING_CONSENT_COOKIE, pendingValue(ownerIdOf(user), consent.id), {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must survive the redirect back from the AA
      maxAge: 60 * 30,
    });

    return parseStringify({ consentId: consent.id, url: consent.url });
  } catch (error) {
    logError("setu: createConsent failed", error);
    return { error: t("connect.setuStartFailed") };
  }
};

/**
 * Step 2, after the customer returns from the AA: confirm the consent is ACTIVE,
 * store one bank row per linked account, and start a data session so the home
 * page has data ready.
 */
export const completeSetuConsent = async ({ consentId }: { consentId?: string }) => {
  const user = await requireUser().catch(() => null);
  if (!user) return { status: "MISSING" as const, added: 0 };
  if (!(await allow(`setu:complete:${ownerIdOf(user)}`, 20, 10 * MINUTE))) return { status: "MISSING" as const, added: 0 };

  // Only the consent this user started in this browser: a consent id in the URL
  // alone could be someone else's, and would attach their accounts to this user.
  const cookieStore = await cookies();
  const pending = readPending(cookieStore.get(PENDING_CONSENT_COOKIE)?.value);
  if (!pending || pending.ownerId !== ownerIdOf(user) || (consentId && consentId !== pending.consentId)) {
    return { status: "MISSING" as const, added: 0 };
  }
  const id = pending.consentId;
  const t = await getT();

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
      Query.equal("userId", [ownerIdOf(user)]),
      Query.equal("provider", [SETU_PROVIDER]),
    ]);
    const known = new Set(existing.documents.map((bank) => bank.accountId as string));

    // Kick off a data session now so the first page load does not have to wait for it.
    let dataSessionId: string | undefined;
    try {
      const session = await createDataSession(id, consentDataRange(consent));
      dataSessionId = session.id;
    } catch (error) {
      logError("setu: could not start the first data session", error);
    }

    let added = 0;
    for (const account of accounts) {
      if (known.has(account.linkRefNumber)) continue;

      await createBankAccount({
        userId: ownerIdOf(user),
        bankId: id,
        accountId: account.linkRefNumber,
        accessToken: id,
        fundingSourceUrl: "",
        sharableId: newSharableId(),
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
    logError("setu: completeSetuConsent failed", error);
    return { status: "ERROR" as const, added: 0, error: t("connect.setuFinishFailed") };
  }
};
