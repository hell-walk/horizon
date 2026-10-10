// Server-only: this client carries the admin API key.
// Never "use server" here: that would turn each function into a public endpoint.
import "server-only";

import { Client, Databases } from "node-appwrite";

// Appwrite keeps Horizon's data: profiles, banks, statements, transfers. Who
// is signed in is Supabase's job (supabase.ts); every query here is limited
// to the signed-in person by the code that calls it (ownerIdOf).
export async function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

  return {
    get database() {
      return new Databases(client);
    },
  };
}
