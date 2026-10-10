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

/** The auth account id (Appwrite user), as opposed to the profile document id in $id. */
export const accountIdOf = (user: User) => (user as User & { userId?: string }).userId ?? user.$id;
