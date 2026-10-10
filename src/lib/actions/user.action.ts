'use server';

// Every export here is a public endpoint the browser can call with any
// arguments. So none of them take "who the user is" as a parameter: that always
// comes from the session cookie. Data helpers that do not check the session
// live in ../server and are never exported from here.
//
// Sign-in is Supabase's job (who you are); the profile, banks and statements
// stay in Appwrite, found by the Supabase user id.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { passwordProblemKey } from "../passwordRules";
import { getT } from "../i18n/server";
import { siteUrl } from "../site";
import type { Translate } from "../i18n/translate";
import { changeBlocked, countChange } from "../server/plan";
import { authIdOf, loadSession, ownerIdOf, requireUser } from "../server/auth";
import { createBankAccount, getUserInfo } from "../server/banks";
import { createProfile, pendingFrom, PROFILE_FIELDS, profileIsValid, type ProfileInput } from "../server/profile";
import { newSharableId } from "../server/crypto";
import { addFundingSource } from "../server/dwolla";
import { allow, clientIp, isBlocked, MINUTE, record } from "../server/rateLimit";
import { clearSessionCookies, createSupabaseServerClient } from "../server/supabase";
import { plaidClient } from "../plaid";
import { logError } from "../server/log";

export type AuthResult = { ok: true; user?: User; checkEmail?: boolean } | { ok: false; error: string };


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

// The rules the forms show (lib/passwordRules.ts), enforced where they cannot
// be skipped. Not exported: every export of this file is a public endpoint.
const passwordProblem = (password: string, email: string, t: Translate): string | null => {
    const key = passwordProblemKey(password, email);
    return key ? t(key) : null;
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
        // Only said after the right password, so it tells nothing to a guesser.
        if ((error as { code?: string } | null)?.code === "email_not_confirmed") return { ok: false, error: t("auth.errorNotConfirmed") };
        if (error) throw error;
        return { ok: true };
    } catch {
        // Same answer for a wrong password, a missing account and a Google-only
        // account: the reply never tells whether an email is registered.
        await record(emailKey(email), 10 * MINUTE);
        return { ok: false, error: t("auth.errorSignIn") };
    }
}

/**
 * Sign-up. Nothing is usable yet: Supabase emails a link, and only a confirmed
 * login gets a Horizon profile (on /welcome). Otherwise someone could sign up
 * with another person's email, and when that person later used "Continue with
 * Google", Supabase would join the two and let the first one in. The details
 * typed here wait on the login meanwhile (never the date of birth or SSN: the
 * US partner's questions are asked after confirming).
 */
export const signUp = async (userData: SignUpParams): Promise<AuthResult> => {
    const t = await getT();
    if (!strings(userData, ["email", "password", ...PROFILE_FIELDS], 256)) return badInput(t);
    const { email, password, firstName, lastName } = userData;
    if (!profileIsValid(userData, { identity: false })) return badInput(t);
    const weak = passwordProblem(password, email, t);
    if (weak) return { ok: false, error: weak };
    if (!(await allowAuthAttempt(email))) return tooMany(t);
    // Each sign-up sends an email: a tighter cap per network.
    if (!(await allow(`signup:ip:${await clientIp()}`, 10, 60 * MINUTE))) return tooMany(t);

    try {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                emailRedirectTo: `${siteUrl()}/auth/callback`,
                data: { full_name: `${firstName.trim()} ${lastName.trim()}`, pending_profile: pendingFrom(userData), terms_accepted_at: new Date().toISOString() },
            },
        });
        if (isRateLimited(error)) return tooMany(t);
        if (error) throw error;
        // The same answer when the email already has an account (Supabase then
        // sends nothing): the reply never tells whether an email is registered.
        return { ok: true, checkEmail: true };
    } catch (error) {
        logError("sign-up failed", error);
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
 * "Finish setting up": a confirmed login (Google, or a US sign-up that still
 * owes the payment partner's questions) with no Horizon profile yet.
 */
export const completeProfile = async (input: ProfileInput & { terms: boolean }): Promise<AuthResult> => {
    const t = await getT();
    const session = await loadSession();
    if (!session) return { ok: false, error: t("auth.errorSignIn") };
    if (!strings(input, PROFILE_FIELDS, 256) || input.terms !== true || !profileIsValid(input, { identity: true })) return badInput(t);
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
        // Opening Plaid costs a call: refused when adding a bank would be, never counted.
        if (await changeBlocked(await getT())) return null;
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
        if (await changeBlocked(await getT())) return null;

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
        await countChange();

        revalidatePath("/");

        return { publicTokenExchange: "complete" as const };
    } catch (error) {
        logError("exchangePublicToken failed", error);
        return null;
    }
};
