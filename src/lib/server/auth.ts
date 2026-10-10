import "server-only";

import { cache } from "react";

import { parseStringify } from "../utils";
import { getUserInfo } from "./banks";
import { createSupabaseServerClient } from "./supabase";

// Fields that never leave the server. The signed-in user is handed to client
// components (top bar, Plaid Link), so anything left on it ends up in the page.
const PRIVATE_FIELDS = ["ssn", "dateOfBirth", "prefs", "targets", "dwollaCustomerUrl", "passwordUpdate", "accessedAt"] as const;

/** Who is signed in, as Supabase knows them: before (or without) a Horizon profile. */
export type SessionUser = {
  id: string;
  email: string;
  provider: string;
  name: string;
  /** Signed up with email and password (Google-only logins have none to ask for). */
  hasPassword: boolean;
  /** When this login last signed in, as milliseconds; 0 if unknown. */
  lastSignInAt: number;
};

// Asks Supabase on every request (getUser, not the cookie alone), so a deleted
// or banned account is signed out at once. React cache() makes it once per request.
export const loadSession = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    const meta = data.user.user_metadata ?? {};
    const providers = (data.user.app_metadata?.providers as string[] | undefined) ?? [String(data.user.app_metadata?.provider ?? "email")];
    return {
      id: data.user.id,
      email: data.user.email,
      provider: String(data.user.app_metadata?.provider ?? "email"),
      name: String(meta.full_name ?? meta.name ?? "").slice(0, 200),
      hasPassword: providers.includes("email"),
      lastSignInAt: Date.parse(data.user.last_sign_in_at ?? "") || 0,
    };
  } catch {
    return null;
  }
});

// React cache() dedupes this within one request: the layout and the page both call it.
export const loadLoggedInUser = cache(async (): Promise<User | null> => {
  const session = await loadSession();
  if (!session) return null;
  // The profile (firstName, lastName, dwolla ids) is found by the Supabase id.
  // $id becomes the profile document id; userId stays the Supabase id. Signed
  // in without a profile (first time with Google) counts as not signed in
  // here: the layout sends them to /welcome to finish setting up.
  const profile = await getUserInfo({ userId: session.id });
  if (!profile) return null;
  const user = parseStringify({ ...profile, email: profile.email ?? session.email, name: `${profile.firstName} ${profile.lastName}`, userId: session.id }) as Record<string, unknown>;
  for (const field of PRIVATE_FIELDS) delete user[field];
  return user as unknown as User;
});

/** The signed-in user (private fields removed), or null. */
export const getLoggedInUser = loadLoggedInUser;

export class NotSignedInError extends Error {
  constructor() {
    super("You need to be signed in.");
  }
}

/** The signed-in user, or throws. Every action that reads or changes user data starts here. */
export async function requireUser(): Promise<User> {
  const user = await loadLoggedInUser();
  if (!user) throw new NotSignedInError();
  return user;
}

// Two ids, two jobs:
// - ownerIdOf: what banks, statements, transfers and settings are stored under
//   (bank.userId). It is the profile document id ($id).
// - authIdOf: the Supabase login, for things that belong to the login itself:
//   deleting it, and Plaid's user id.
// Never mix them: ownership checks compare against ownerIdOf only.

/** The id every bank, statement and transfer row is stored under. */
export const ownerIdOf = (user: User) => user.$id;

/** The Supabase login id, as opposed to the profile document id. */
export const authIdOf = (user: User) => (user as User & { userId?: string }).userId ?? user.$id;
