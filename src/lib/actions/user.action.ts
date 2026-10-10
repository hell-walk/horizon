'use server';

// Every export here is a public endpoint the browser can call with any
// arguments. So none of them take "who the user is" as a parameter: that always
// comes from the session cookie. Data helpers that do not check the session
// live in ../server and are never exported from here.
//
// Sign-in is Supabase's job (who you are); the profile, banks and statements
// stay in Appwrite, found by the Supabase user id.

import { ID } from "node-appwrite";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { isCountry, needsStateAndPostal } from "../countries";
import { getT } from "../i18n/server";
import type { Translate } from "../i18n/translate";
import { createAdminClient } from "../server/appwrite";
import { authIdOf, loadSession, ownerIdOf, requireUser } from "../server/auth";
import { createBankAccount, getUserInfo } from "../server/banks";
import { newSharableId } from "../server/crypto";
import { addFundingSource, createDwollaCustomer } from "../server/dwolla";
import { allow, clientIp, isBlocked, MINUTE, record } from "../server/rateLimit";
import { clearSessionCookies, createSupabaseAdmin, createSupabaseServerClient } from "../server/supabase";
import { extractCustomerIdFromUrl } from "../utils";
import { plaidClient } from "../plaid";
import { logError } from "../server/log";

const {
    APPWRITE_DATABASE_ID: DATABASE_ID,
    APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

export type AuthResult = { ok: true; user?: User } | { ok: false; error: string };

// Where Supabase sends people back to (Google sign-in, password reset links).
// From the configuration, never from the request: a forged Host header must
// not be able to point a reset link at someone else's site.
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The server talks to Supabase from one address for everyone, so its per-IP
// limits cannot tell people apart: sign-in and sign-up are limited here instead.
// - Per email: 8 wrong passwords in 10 minutes. Only failures count, so someone
//   signing in on several devices is never locked out.
// - Per IP: 100 attempts in 10 minutes, generous because a whole college or
//   office can share one public IP.
const EMAIL_FAILURES = 8;
const emailKey = (email: string) => `auth:fail:${String(email ?? "").trim().toLowerCase()}`;

const allowAuthAttempt = async (email: string) => {
    if (await isBlocked(emailKey(email), EMAIL_FAILURES)) return false;
    return await allow(`auth:ip:${await clientIp()}`, 100, 10 * MINUTE);
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

/** Supabase saying "slow down" (its own limits), as opposed to a wrong password. */
const isRateLimited = (error: unknown) => (error as { status?: number } | null)?.status === 429;

export const signIn = async (input: signInProps): Promise<AuthResult> => {
    const t = await getT();
    if (!strings(input, ["email", "password"], 256)) return badInput(t);
    const { email, password } = input;
    if (!(await allowAuthAttempt(email))) return tooMany(t);
    try {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (isRateLimited(error)) return tooMany(t);
        if (error) throw error;
        return { ok: true };
    } catch {
        // Same answer for a wrong password, a missing account and a Google-only
        // account: the reply never tells whether an email is registered.
        await record(emailKey(email), 10 * MINUTE);
        return { ok: false, error: t("auth.errorSignIn") };
    }
}

const US_STATES = new Set(("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" "));
const isUsAddress = (state: string, postalCode: string) =>
    US_STATES.has(state.trim().toUpperCase()) && /^\d{5}(-\d{4})?$/.test(postalCode.trim());

// Date of birth and SSN go to Dwolla once, to open the payments customer, and are
// never needed again, so Horizon does not keep them.
const NOT_KEPT = "not-kept";

const PROFILE_FIELDS = ["country", "firstName", "lastName", "address1", "city", "state", "postalCode", "dateOfBirth", "ssn"];
type ProfileInput = Omit<SignUpParams, "email" | "password">;

/** What sign-up and "finish setting up" ask, checked the same way: true when it is fine. */
const profileIsValid = (p: ProfileInput) => {
    if (!isCountry(p.country)) return false;
    if (p.firstName.trim().length < 2 || p.lastName.trim().length < 2 || p.address1.trim().length < 3 || p.city.trim().length < 2) return false;
    // The US payment partner needs a US address, date of birth and SSN; nobody else is asked.
    if (needsStateAndPostal(p.country) && (p.state.trim().length < 2 || !/^[A-Za-z0-9 -]{3,10}$/.test(p.postalCode.trim()))) return false;
    if (p.country === "US" && (!isUsAddress(p.state, p.postalCode) || !/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth) || p.ssn.trim().length < 4)) return false;
    return true;
};

/** Creates the Appwrite profile for a Supabase login. Returns the profile row's id. */
const createProfile = async (authId: string, email: string, p: ProfileInput) => {
    // Dwolla (US transfers) only accepts US addresses. Everyone else signs up
    // without a Dwolla customer: they can still link banks and import
    // statements, only transfers stay unavailable.
    const dwolla: { dwollaCustomerId?: string; dwollaCustomerUrl?: string } = {};
    if (p.country === "US") {
        try {
            const dwollaCustomerUrl = await createDwollaCustomer({ ...p, email, type: 'personal' });
            if (dwollaCustomerUrl) {
                dwolla.dwollaCustomerUrl = dwollaCustomerUrl;
                dwolla.dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
            }
        } catch {
            console.warn('Dwolla customer not created; continuing without transfers');
        }
    }

    const { database } = await createAdminClient();
    const row = await database.createDocument(DATABASE_ID!, USER_COLLECTION_ID!, ID.unique(), {
        address1: p.address1.trim(),
        city: p.city.trim(),
        state: p.state.trim(),
        postalCode: p.postalCode.trim(),
        email,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        dateOfBirth: NOT_KEPT,
        ssn: NOT_KEPT,
        userId: authId,
        // The person's settings start with their country (see server/prefs.ts).
        prefs: JSON.stringify({ country: p.country }),
        ...dwolla,
    });
    return row.$id;
};

export const signUp = async (userData: SignUpParams): Promise<AuthResult> => {
    const t = await getT();
    if (!strings(userData, ["email", "password", ...PROFILE_FIELDS], 256)) return badInput(t);
    const { email, password, firstName, lastName } = userData;
    if (!profileIsValid(userData)) return badInput(t);
    const weak = passwordProblem(password, email, t);
    if (weak) return { ok: false, error: weak };
    if (!(await allowAuthAttempt(email))) return tooMany(t);
    // Each sign-up creates real accounts (Supabase, Appwrite, maybe Dwolla): a tighter cap per network.
    if (!(await allow(`signup:ip:${await clientIp()}`, 10, 60 * MINUTE))) return tooMany(t);

    let authId: string | undefined;
    let profileId: string | undefined;
    try {
        // Created as already confirmed: Horizon does not send a confirmation email.
        const admin = createSupabaseAdmin();
        const { data, error } = await admin.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: { full_name: `${firstName.trim()} ${lastName.trim()}` },
        });
        if (error || !data.user) throw error ?? new Error("Supabase returned no user");
        authId = data.user.id;

        profileId = await createProfile(authId, email.trim(), userData);

        const supabase = await createSupabaseServerClient();
        const signedIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signedIn.error) throw signedIn.error;

        return { ok: true, user: { $id: profileId, userId: authId, email: email.trim(), firstName, lastName, name: `${firstName} ${lastName}` } as User };
    } catch (error) {
        logError("sign-up failed", error)

        // Roll back what was made, so a failed sign-up can be retried with the same email.
        if (profileId) {
            try {
                const { database } = await createAdminClient();
                await database.deleteDocument(DATABASE_ID!, USER_COLLECTION_ID!, profileId);
            } catch (cleanupError) {
                logError('Could not remove the partially created profile', cleanupError);
            }
        }
        if (authId) {
            try {
                await createSupabaseAdmin().auth.admin.deleteUser(authId);
            } catch (cleanupError) {
                logError('Could not remove the partially created user', cleanupError);
            }
        }
        return { ok: false, error: t("auth.errorSignUp") };
    }
}

/**
 * Starts "Continue with Google". Returns Google's address for the browser to
 * go to; Google sends the person back to /auth/callback. The one-time code
 * check (PKCE) is kept in a cookie, so the callback only works in this browser.
 */
export const signInWithGoogle = async (): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const t = await getT();
    if (!(await allow(`auth:google:${await clientIp()}`, 30, 10 * MINUTE))) return { ok: false, error: t("auth.errorTooMany") };
    try {
        const supabase = await createSupabaseServerClient();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${siteUrl()}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
        });
        if (error || !data.url) throw error ?? new Error("no URL");
        return { ok: true, url: data.url };
    } catch (error) {
        logError("Google sign-in could not start", error);
        return { ok: false, error: t("auth.errorGoogle") };
    }
}

/**
 * "Finish setting up": signed in (with Google) but no Horizon profile yet. Asks
 * what sign-up asks, minus the email and password Google already settled.
 */
export const completeProfile = async (input: ProfileInput & { terms: boolean }): Promise<AuthResult> => {
    const t = await getT();
    const session = await loadSession();
    if (!session) return { ok: false, error: t("auth.errorSignIn") };
    if (!strings(input, PROFILE_FIELDS, 256) || input.terms !== true || !profileIsValid(input)) return badInput(t);
    if (!(await allow(`signup:ip:${await clientIp()}`, 10, 60 * MINUTE))) return tooMany(t);
    // One profile per login, even when the form is sent twice.
    if (!(await allow(`welcome:${session.id}`, 1, MINUTE))) return tooMany(t);
    if (await getUserInfo({ userId: session.id })) return { ok: true };

    try {
        const profileId = await createProfile(session.id, session.email, input);
        revalidatePath("/", "layout");
        return { ok: true, user: { $id: profileId, userId: session.id, email: session.email, firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}` } as User };
    } catch (error) {
        logError("finishing the profile failed", error);
        return { ok: false, error: t("auth.errorSignUp") };
    }
}

/**
 * Sends a "set a new password" link. Always answers the same way, whether or
 * not the email has an account, so nobody can use it to test emails.
 */
export const requestPasswordReset = async (input: { email: string }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const t = await getT();
    if (!strings(input, ["email"], 256) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return badInput(t) as { ok: false; error: string };
    const email = input.email.trim().toLowerCase();
    // Every request may send an email: few per address, a few more per network.
    if (!(await allow(`reset:ip:${await clientIp()}`, 10, 60 * MINUTE))) return tooMany(t) as { ok: false; error: string };
    if (!(await allow(`reset:email:${email}`, 3, 60 * MINUTE))) return { ok: true };
    try {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
        if (error && !isRateLimited(error)) logError("password reset email failed", error);
    } catch (error) {
        logError("password reset email failed", error);
    }
    return { ok: true };
}

/** Sets a new password for the signed-in person (after following a reset link). */
export const setNewPassword = async (input: { password: string }): Promise<AuthResult> => {
    const t = await getT();
    const session = await loadSession();
    if (!session) return { ok: false, error: t("auth.errorResetExpired") };
    if (!strings(input, ["password"], 256)) return badInput(t);
    const weak = passwordProblem(input.password, session.email, t);
    if (weak) return { ok: false, error: weak };
    if (!(await allow(`reset:set:${session.id}`, 5, 10 * MINUTE))) return tooMany(t);
    try {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.updateUser({ password: input.password });
        if (error) throw error;
        // Other devices signed in with the old password are signed out.
        await supabase.auth.signOut({ scope: "others" }).catch(() => {});
        return { ok: true };
    } catch (error) {
        logError("setting a new password failed", error);
        return { ok: false, error: t("auth.errorResetFailed") };
    }
}

export const logoutAccount = async () => {
    try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
        // The session may already be invalid; clearing the cookie below still logs the user out.
        logError('Error ending the Supabase session', error);
    }

    await clearSessionCookies();
    (await cookies()).delete("setu-consent"); // a half-finished bank link belongs to this user only

    return true;
}

export const createLinkToken = async () => {
    try {
        const user = await requireUser();
        // Each call costs a Plaid API request.
        if (!(await allow(`plaid:link:${ownerIdOf(user)}`, 20, 10 * MINUTE))) return null;
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
        if (!(await allow(`plaid:exchange:${ownerIdOf(user)}`, 10, 10 * MINUTE))) return null;

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
