import type { Metadata } from "next";

import { getT } from "@/lib/i18n/server";

import AuthForm from "../components/authForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("auth.signInTitle"),
    description: t("auth.signInDescription"),
    robots: { index: true, follow: true },
  };
}

// ?failed=1: coming back from Google (or an old sign-in link) did not work.
const SignIn = async ({ searchParams }: { searchParams: Promise<{ failed?: string }> }) => {
  const { failed } = await searchParams;
  const t = await getT();
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-in" notice={failed === "1" ? t("auth.noticeSignInFailed") : undefined} />
    </section>
  );
};

export default SignIn;
