import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getT } from "@/lib/i18n/server";
import { loadSession } from "@/lib/server/auth";

import { ResetPasswordForm } from "../components/passwordForms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.resetTitle"), robots: { index: false, follow: false } };
}

// Reached through the emailed link: /auth/callback has already signed the
// person in, so here they only choose the new password.
export default async function ResetPassword() {
  const session = await loadSession();
  if (!session) redirect("/forgot-password?expired=1");
  return (
    <section className="flex w-full justify-center">
      <ResetPasswordForm email={session.email} />
    </section>
  );
}
