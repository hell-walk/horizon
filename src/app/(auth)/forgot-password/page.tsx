import type { Metadata } from "next";

import { getT } from "@/lib/i18n/server";

import { ForgotPasswordForm } from "../components/passwordForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.forgotTitle"), description: t("auth.forgotDescription"), robots: { index: false, follow: true } };
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <section className="flex w-full justify-center">
      <ForgotPasswordForm expired={expired === "1"} />
    </section>
  );
}
