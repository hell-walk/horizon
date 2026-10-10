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

const SignIn = () => {
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-in" />
    </section>
  );
};

export default SignIn;
