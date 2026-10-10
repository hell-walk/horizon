import "server-only";

import { cache } from "react";

import { parseStringify } from "../utils";
import { createSessionClient } from "./appwrite";
import { getUserInfo } from "./banks";

// Fields that never leave the server. The signed-in user is handed to client
// components (top bar, Plaid Link), so anything left on it ends up in the page.
const PRIVATE_FIELDS = ["ssn", "dateOfBirth", "prefs", "targets", "dwollaCustomerUrl", "passwordUpdate", "accessedAt"] as const;

// React cache() dedupes this within one request: the layout and the page both call it.
export const loadLoggedInUser = cache(async (): Promise<User | null> => {
  try {
    const { account } = await createSessionClient();
    const result = await account.get();

    // Merge the auth account (name, email) with the profile document
    // (firstName, lastName, dwolla ids). $id becomes the profile document id;
    // userId stays the auth account id.
    const profile = await getUserInfo({ userId: result.$id });
    const user = parseStringify({ ...result, ...profile, userId: result.$id }) as Record<string, unknown>;
    for (const field of PRIVATE_FIELDS) delete user[field];
    return user as unknown as User;
  } catch {
    return null;
  }
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
// - ownerIdOf: what banks, statements and transfers are stored under (bank.userId).
//   It is the profile document id ($id); for an account without a profile row,
//   the auth id (there is nothing else to point at).
// - authIdOf: the Appwrite auth account, for things that belong to the login
//   itself: account preferences (saved column layouts) and Plaid's user id.
// Never mix them: ownership checks compare against ownerIdOf only.

/** The id every bank, statement and transfer row is stored under. */
export const ownerIdOf = (user: User) => user.$id;

/** The Appwrite auth account id, as opposed to the profile document id. */
export const authIdOf = (user: User) => (user as User & { userId?: string }).userId ?? user.$id;
