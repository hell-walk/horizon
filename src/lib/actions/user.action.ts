'use server';

// Every export here is a public endpoint the browser can call with any
// arguments. So none of them take "who the user is" as a parameter: that always
// comes from the session cookie. Data helpers that do not check the session
// live in ../server and are never exported from here.

import { ID } from "node-appwrite";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { isCountry, needsStateAndPostal } from "../countries";
import { getT } from "../i18n/server";
import type { Translate } from "../i18n/translate";
import { createAdminClient, createSessionClient } from "../server/appwrite";
import { authIdOf, ownerIdOf, requireUser } from "../server/auth";
import { createBankAccount } from "../server/banks";
import { newSharableId } from "../server/crypto";
import { addFundingSource, createDwollaCustomer } from "../server/dwolla";
import { allow, clientIp, isBlocked, MINUTE, record } from "../server/rateLimit";
import { extractCustomerIdFromUrl } from "../utils";
import { plaidClient } from "../plaid";
import { logError } from "../server/log";

const {
    APPWRITE_DATABASE_ID: DATABASE_ID,
    APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

export type AuthResult = { ok: true; user?: User } | { ok: false; error: string };

const SESSION_COOKIE = "banking-session";

const MAX_SESSION_DAYS = 30;

// Expires with the Appwrite session, and never later than 30 days from sign-in.
// Secure everywhere except local development over plain HTTP (e.g. a phone on
// the same Wi-Fi), where the browser would otherwise drop the cookie.
const setSessionCookie = async (session: { secret: string; expire?: string }) => {
    const cap = Date.now() + MAX_SESSION_DAYS * 24 * 60 * MINUTE;
    const appwriteExpiry = session.expire ? Date.parse(session.expire) : NaN;
    (await cookies()).set(SESSION_COOKIE, session.secret, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        expires: new Date(Number.isFinite(appwriteExpiry) ? Math.min(appwriteExpiry, cap) : cap),
    });
};

// The server talks to Appwrite with an API key, which skips Appwrite's own
// per-IP limits, so sign-in and sign-up are limited here instead.
// - Per email: 8 wrong passwords in 10 minutes. Only failures count, so someone
//   signing in on several devices is never locked out.
// - Per IP: 100 attempts in 10 minutes, generous because a whole college or
//   office can share one public IP.
const EMAIL_FAILURES = 8;
const emailKey = (email: string) => `auth:fail:${String(email ?? "").trim().toLowerCase()}`;

const allowAuthAttempt = async (email: string) => {
    if (isBlocked(emailKey(email), EMAIL_FAILURES)) return false;
    return allow(`auth:ip:${await clientIp()}`, 100, 10 * MINUTE);
};

// Callers can send anything, not just what the form sends: check the shape first.
const strings = (value: unknown, keys: string[], max = 200): value is Record<string, string> =>
    typeof value === "object" && value !== null &&
    keys.every((k) => typeof (value as Record<string, unknown>)[k] === "string" && ((value as Record<string, string>)[k]).length <= max);
// Messages come from en/auth.json and hi/auth.json ("auth.errorCheckDetails" etc.).
const badInput = (t: Translate): AuthResult => ({ ok: false, error: t("auth.errorCheckDetails") });
const tooMany = (t: Translate): AuthResult => ({ ok: false, error: t("auth.errorTooMany") });

// The sign-up form's rule, enforced where it cannot be skipped. Not exported:
// every export of this file is a public endpoint.
const COMMON_PASSWORDS = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "11111111", "00000000", "abcd1234", "admin123", "letmein1", "welcome1"]);
const passwordProblem = (password: string, email: string, t: Translate): string | null => {
    if (password.length < 8) return t("auth.passwordTooShort");
    if (password.length > 128) return t("auth.passwordTooLong");
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) return t("auth.passwordCommon");
    const name = email.split("@")[0]?.toLowerCase() ?? "";
    if (name.length >= 4 && lower.includes(name)) return t("auth.passwordHasEmail");
    return null;
};

export const signIn = async (input: signInProps): Promise<AuthResult> => {
    const t = await getT();
    if (!strings(input, ["email", "password"], 256)) return badInput(t);
    const { email, password } = input;
    if (!(await allowAuthAttempt(email))) return tooMany(t);
    try {
        const { account } = await createAdminClient();
        const session = await account.createEmailPasswordSession(email, password);
        await setSessionCookie(session);
        return { ok: true };
    } catch {
        record(emailKey(email), 10 * MINUTE);
        return { ok: false, error: t("auth.errorSignIn") };
    }
}

const US_STATES = new Set(("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" "));
const isUsAddress = (state: string, postalCode: string) =>
    US_STATES.has(state.trim().toUpperCase()) && /^\d{5}(-\d{4})?$/.test(postalCode.trim());

// Date of birth and SSN go to Dwolla once, to open the payments customer, and are
// never needed again, so Horizon does not keep them.
const NOT_KEPT = "not-kept";

export const signUp = async (userData: SignUpParams): Promise<AuthResult> => {
    const t = await getT();
    if (!strings(userData, ["country", "email", "password", "firstName", "lastName", "address1", "city", "state", "postalCode", "dateOfBirth", "ssn"], 256)) return badInput(t);
    const { country, email, password, firstName, lastName, address1, city, state, postalCode } = userData
    if (!isCountry(country)) return badInput(t);
    // The US payment partner needs a US address, date of birth and SSN; nobody else is asked.
    if (needsStateAndPostal(country) && (state.trim().length < 2 || !/^[A-Za-z0-9 -]{3,10}$/.test(postalCode.trim()))) return badInput(t);
    if (country === "US" && (!isUsAddress(state, postalCode) || !/^\d{4}-\d{2}-\d{2}$/.test(userData.dateOfBirth) || userData.ssn.trim().length < 4)) return badInput(t);
    const profile = { address1, city, state: state.trim(), postalCode: postalCode.trim() };
    const weak = passwordProblem(password, email, t);
    if (weak) return { ok: false, error: weak };
    if (!(await allowAuthAttempt(email))) return tooMany(t);
    // Each sign-up creates real accounts (Appwrite, maybe Dwolla): a tighter cap per network.
    if (!allow(`signup:ip:${await clientIp()}`, 10, 60 * MINUTE)) return tooMany(t);

    let newUserAccount;
    try {
        const { account, database } = await createAdminClient();

        newUserAccount = await account.create(
            ID.unique(),
            email,
            password,
            `${firstName} ${lastName}`,
        );

        // Dwolla (US transfers) only accepts US addresses. Everyone else signs up
        // without a Dwolla customer: they can still link banks and import
        // statements, only transfers stay unavailable.
        const dwolla: { dwollaCustomerId?: string; dwollaCustomerUrl?: string } = {};
        if (country === "US") {
            try {
                const dwollaCustomerUrl = await createDwollaCustomer({ ...userData, type: 'personal' });
                if (dwollaCustomerUrl) {
                    dwolla.dwollaCustomerUrl = dwollaCustomerUrl;
                    dwolla.dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
                }
            } catch {
                console.warn('Dwolla customer not created; continuing without transfers');
            }
        }

        await database.createDocument(
            DATABASE_ID!,
            USER_COLLECTION_ID!,
            ID.unique(),
            {
                ...profile,
                email,
                firstName,
                lastName,
                dateOfBirth: NOT_KEPT,
                ssn: NOT_KEPT,
                userId: newUserAccount.$id,
                ...dwolla,
            }
        )

        // The country lives with the login's preferences (no change to the profile table).
        const { user: users } = await createAdminClient();
        await users.updatePrefs(newUserAccount.$id, { country });

        const session = await account.createEmailPasswordSession(email, password);
        await setSessionCookie(session);

        return { ok: true, user: { $id: newUserAccount.$id, email, firstName, lastName, name: `${firstName} ${lastName}` } as User };
    } catch (error) {
        logError("sign-up failed", error)

        // Roll back the auth account so a failed sign-up can be retried with the same email.
        if (newUserAccount) {
            try {
                const { user } = await createAdminClient();
                await user.delete(newUserAccount.$id);
            } catch (cleanupError) {
                logError('Could not remove the partially created user', cleanupError);
            }
        }
        return { ok: false, error: t("auth.errorSignUp") };
    }
}

export const logoutAccount = async () => {
    try {
        const { account } = await createSessionClient();
        await account.deleteSession('current');
    } catch (error) {
        // The session may already be invalid; clearing the cookie below still logs the user out.
        logError('Error deleting the Appwrite session', error);
    }

    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete("setu-consent"); // a half-finished bank link belongs to this user only

    return true;
}

export const createLinkToken = async () => {
    try {
        const user = await requireUser();
        // Each call costs a Plaid API request.
        if (!allow(`plaid:link:${ownerIdOf(user)}`, 20, 10 * MINUTE)) return null;
        const response = await plaidClient.linkTokenCreate({
            user: { client_user_id: authIdOf(user) },
            client_name: "Horizon",
            products: ['auth', 'transactions'] as Products[],
            language: 'en',
            country_codes: ['US'] as CountryCode[],
        })
        return { linkToken: response.data.link_token };
    } catch (error) {
        logError("createLinkToken failed", error);
        return null;
    }
}

export const exchangePublicToken = async ({ publicToken }: { publicToken: string }) => {
    try {
        const user = await requireUser();
        if (typeof publicToken !== "string" || !publicToken || publicToken.length > 200) return null;
        if (!allow(`plaid:exchange:${ownerIdOf(user)}`, 10, 10 * MINUTE)) return null;

        // Exchange the short-lived public token for a permanent access token
        const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        // Get the account linked through Plaid Link
        const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
        const accountData = accountsResponse.data.accounts[0];

        // Attach the bank to the user's Dwolla customer as a funding source so it
        // can send and receive transfers. Users without a Dwolla customer (non-US
        // address) still get the bank, just without transfers.
        let fundingSourceUrl = "";
        if (user.dwollaCustomerId) {
            const request: ProcessorTokenCreateRequest = {
                access_token: accessToken,
                account_id: accountData.account_id,
                processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
            };
            const processorTokenResponse = await plaidClient.processorTokenCreate(request);
            const processorToken = processorTokenResponse.data.processor_token;

            fundingSourceUrl =
                (await addFundingSource({
                    dwollaCustomerId: user.dwollaCustomerId,
                    processorToken,
                    bankName: accountData.name,
                })) ?? "";

            if (!fundingSourceUrl) throw Error("Funding source was not created");
        }

        await createBankAccount({
            userId: ownerIdOf(user),
            bankId: itemId,
            accountId: accountData.account_id,
            accessToken,
            fundingSourceUrl,
            sharableId: newSharableId(),
        });

        revalidatePath("/");

        return { publicTokenExchange: "complete" as const };
    } catch (error) {
        logError("exchangePublicToken failed", error);
        return null;
    }
};
