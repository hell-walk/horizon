import type { Metadata } from "next";

import { getT } from "@/lib/i18n/server";

import AuthForm from "../components/authForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("auth.signUpTitle"),
    description: t("auth.signUpDescription"),
    robots: { index: true, follow: true },
  };
}

const SignUp = async () => {
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-up" />
    </section>
  );
};

export default SignUp;
