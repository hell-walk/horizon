import "server-only";

import { ID } from "node-appwrite";

import { isCountry, needsStateAndPostal } from "../countries";
import { extractCustomerIdFromUrl } from "../utils";
import { createAdminClient } from "./appwrite";
import { createDwollaCustomer } from "./dwolla";
import { logError } from "./log";
import { createSupabaseAdmin } from "./supabase";

// The Horizon profile (Appwrite) behind a Supabase login: what sign-up and
// "finish setting up" ask, how it is checked, and how it is created. A profile
// is only ever created for a confirmed login, so nobody can set one up under
// someone else's email address.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID } = process.env;

export const PROFILE_FIELDS = ["country", "firstName", "lastName", "address1", "city", "state", "postalCode", "dateOfBirth", "ssn"];
export type ProfileInput = Omit<SignUpParams, "email" | "password">;

const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const isUsAddress = (state: string, postalCode: string) => US_STATES.has(state.trim().toUpperCase()) && /^\d{5}(-\d{4})?$/.test(postalCode.trim());

// Date of birth and SSN go to Dwolla once, to open the payments customer, and are
// never needed again, so Horizon does not keep them.
const NOT_KEPT = "not-kept";

/**
 * True when the details are fine. `identity`: also require the US date of birth
 * and SSN (asked only when the profile is created, after the email is confirmed).
 */
export function profileIsValid(p: ProfileInput, { identity }: { identity: boolean }) {
  if (!isCountry(p.country)) return false;
  if (p.firstName.trim().length < 2 || p.lastName.trim().length < 2 || p.address1.trim().length < 3 || p.city.trim().length < 2) return false;
  if (p.address1.length > 50 || p.city.length > 20 || p.state.length > 30) return false;
  // The US payment partner needs a US address, date of birth and SSN; nobody else is asked.
  if (needsStateAndPostal(p.country) && (p.state.trim().length < 2 || !/^[A-Za-z0-9 -]{3,10}$/.test(p.postalCode.trim()))) return false;
  if (p.country === "US" && !isUsAddress(p.state, p.postalCode)) return false;
  if (identity && p.country === "US" && (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth) || p.ssn.trim().length < 4)) return false;
  return true;
}

/** The sign-up details waiting on the login until its email is confirmed (never the date of birth or SSN). */
export const pendingFrom = (p: ProfileInput) => ({
  country: p.country,
  firstName: p.firstName.trim(),
  lastName: p.lastName.trim(),
  address1: p.address1.trim(),
  city: p.city.trim(),
  state: p.state.trim(),
  postalCode: p.postalCode.trim(),
});

/** Reads them back defensively (the person can edit their own login's metadata). */
export function readPending(value: unknown): ProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const keys = ["country", "firstName", "lastName", "address1", "city", "state", "postalCode"];
  if (!keys.every((k) => typeof v[k] === "string" && (v[k] as string).length <= 100)) return null;
  const p = { ...(Object.fromEntries(keys.map((k) => [k, v[k]])) as Record<string, string>), dateOfBirth: "", ssn: "" } as ProfileInput;
  return profileIsValid(p, { identity: false }) ? p : null;
}

/** Creates the Appwrite profile for a confirmed Supabase login. Returns the profile row's id. */
export async function createProfile(authId: string, email: string, p: ProfileInput) {
  // Dwolla (US transfers) only accepts US addresses. Everyone else has no Dwolla
  // customer: they can still link banks and import statements, only transfers
  // stay unavailable.
  const dwolla: { dwollaCustomerId?: string; dwollaCustomerUrl?: string } = {};
  if (p.country === "US") {
    try {
      const dwollaCustomerUrl = await createDwollaCustomer({ ...p, email, type: "personal" });
      if (dwollaCustomerUrl) {
        dwolla.dwollaCustomerUrl = dwollaCustomerUrl;
        dwolla.dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
      }
    } catch {
      console.warn("Dwolla customer not created; continuing without transfers");
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

  // The waiting copy on the login is not needed any more: keep one copy only.
  try {
    await createSupabaseAdmin().auth.admin.updateUserById(authId, { user_metadata: { pending_profile: null } });
  } catch (error) {
    logError("profile: could not clear the sign-up details on the login", error);
  }
  return row.$id;
}
