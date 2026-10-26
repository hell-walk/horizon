import type { Metadata } from "next";

import { countryList } from "@/lib/content/countries";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { publicPage } from "@/lib/content/seo";

import AuthForm from "../components/authForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return publicPage(t("auth.signUpTitle"), t("auth.signUpDescription"), "/sign-up");
}

const SignUp = async () => {
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-up" countries={countryList(LOCALE_TAGS[await getLocale()])} />
    </section>
  );
};

export default SignUp;
