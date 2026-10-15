import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, loadSession } from "@/lib/server/auth";
import { DataUnavailableError, getUserInfo } from "@/lib/server/banks";
import { logError } from "@/lib/server/log";
import { createProfile } from "@/lib/server/profile";
import { claim, release } from "@/lib/server/shared";

import AuthForm from "../components/authForm";
import DataUnavailable from "@/components/dataUnavailable";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.welcomeTitle"), robots: { index: false, follow: false } };
}

// A confirmed login without a Horizon profile lands here.
// - Signed up with email: the details typed at sign-up become the profile now
//   that the email is confirmed (US: the payment partner's questions first).
// - Signed in with Google for the first time: country, name and address.
export default async function Welcome() {
  const session = await loadSession();
  if (!session) redirect("/sign-in");
  const pending = session.pendingProfile;
  try {
    if (await getLoggedInUser()) redirect("/");

    if (pending && pending.country !== "US") {
      // One profile per login, even with two tabs open.
      if (await claim("welcome", session.id, 60_000)) {
        try {
          if (!(await getUserInfo({ userId: session.id }))) await createProfile(session.id, session.email, pending);
        } catch (error) {
          if (error instanceof DataUnavailableError) throw error;
          logError("welcome: could not create the profile", error);
        } finally {
          await release("welcome", session.id);
        }
      }
      if (await getUserInfo({ userId: session.id })) redirect("/");
    }
  } catch (error) {
    // The records store is not answering: no setup form, or a second profile
    // could be made once it is back.
    if (error instanceof DataUnavailableError) return <DataUnavailable />;
    throw error;
  }

  return (
    <section className="flex w-full justify-center">
      <AuthForm type="welcome" email={session.email} defaults={pending ?? undefined} />
    </section>
  );
}
