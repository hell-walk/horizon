import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, loadSession } from "@/lib/server/auth";

import AuthForm from "../components/authForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.welcomeTitle"), robots: { index: false, follow: false } };
}

// The one-time "finish setting up" step after the first Google sign-in: Google
// settled the email, Horizon still needs the country, name and address.
export default async function Welcome() {
  const session = await loadSession();
  if (!session) redirect("/sign-in");
  if (await getLoggedInUser()) redirect("/");
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="welcome" email={session.email} />
    </section>
  );
}
