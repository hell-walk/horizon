"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale, useT } from "@/components/i18nProvider";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { signIn, signUp } from "@/lib/actions/user.action";
import { countryList, needsStateAndPostal, needsUsIdentity } from "@/lib/countries";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { authFormSchema, cn } from "@/lib/utils";

import CustomInput from "./customInput";
import DateInput from "./dateInput";
import ImportStatement from "@/components/importStatement";
import PlaidLink from "@/components/plaidLink";
import SetuLink from "@/components/setuLink";

// Sign-up sections: anchor id and the message key of the title.
const SECTIONS = [
  { id: "section-01", title: "auth.sectionAbout" },
  { id: "section-02", title: "auth.sectionAddress" },
  { id: "section-03", title: "auth.sectionLogin" },
];

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <fieldset className="flex flex-col gap-4">
    <legend className="mb-4 flex w-full items-center justify-between gap-3 border-b border-line pb-2">
      <span className="font-display text-13 font-semibold uppercase tracking-wide text-ink">{title}</span>
      {hint && <span className="eyebrow text-right">{hint}</span>}
    </legend>
    {children}
  </fieldset>
);

// Three-level strength bar: length, a digit, a symbol or capital.
const strengthOf = (password: string) =>
  [password.length >= 8, /\d/.test(password), /[^A-Za-z0-9]/.test(password) || /[A-Z]/.test(password)].filter(Boolean).length;

const AuthForm = ({ type }: { type: string }) => {
  const t = useT();
  const locale = useLocale();
  const countries = useMemo(() => countryList(LOCALE_TAGS[locale]), [locale]);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSignUp = type === "sign-up";
  const formSchema = authFormSchema(type, t);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
      country: "",
      firstName: "",
      lastName: "",
      address1: "",
      city: "",
      state: "",
      postalCode: "",
      dob: "",
      ssn: "",
    },
  });

  const password = form.watch("password") ?? "";
  const country = form.watch("country") ?? "";
  const usIdentity = needsUsIdentity(country);
  const regionRequired = needsStateAndPostal(country);
  const strength = strengthOf(password);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Honeypot: real users never fill the hidden field, bots usually do.
    const trap = (document.getElementById("company-website") as HTMLInputElement | null)?.value;
    if (trap) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        const newUser = await signUp({
          country: data.country!,
          firstName: data.firstName!,
          lastName: data.lastName!,
          address1: data.address1!,
          city: data.city!,
          state: data.state ?? "",
          postalCode: data.postalCode ?? "",
          // Only the US payment partner needs these; nobody else is asked, or sends them.
          dateOfBirth: needsUsIdentity(data.country ?? "") ? (data.dob ?? "") : "",
          ssn: needsUsIdentity(data.country ?? "") ? (data.ssn ?? "") : "",
          email: data.email,
          password: data.password,
        });

        if (!newUser.ok) setErrorMessage(newUser.error);
        else setUser(newUser.user ?? null);
      } else {
        const response = await signIn({ email: data.email, password: data.password });
        if (response.ok) router.push("/");
        else setErrorMessage(response.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(t("common.tryAgain"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{user ? t("auth.eyebrowNextStep") : isSignUp ? t("auth.eyebrowSignUp") : t("auth.eyebrowSignIn")}</p>
        <h1 className="h-display">{user ? t("auth.headingAddBank") : isSignUp ? t("auth.headingSignUp") : t("auth.headingSignIn")}</h1>
        <p className="text-14 text-ink-muted">{user ? t("auth.introAddBank") : isSignUp ? t("auth.introSignUp") : t("auth.introSignIn")}</p>
      </header>

      {user ? (
        <div className="flex flex-col gap-3">
          <PlaidLink user={user} variant="primary" />
          <SetuLink user={user} variant="primary" />
          <ImportStatement variant="primary" />
          <Link href="/" className="btn-ghost">
            {t("auth.skipForNow")} <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          {isSignUp && (
            <nav className="grid grid-cols-3 gap-1" aria-label={t("auth.formSections")}>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center justify-center gap-2 rounded-sm border border-line bg-card px-1 py-2 text-center font-mono text-[12px] uppercase tracking-wider text-ink-muted hover:bg-surface-container"
                >
                  {t(s.title)}
                </a>
              ))}
            </nav>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8" noValidate>
              {isSignUp && (
                <>
                  <div id="section-01" className="scroll-mt-6">
                    <Section title={t("auth.sectionAbout")} hint={t("auth.sectionAboutHint")}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem className="field sm:col-span-2">
                              <label className="field-label" htmlFor="signup-country">
                                {t("auth.country")}
                              </label>
                              <select
                                id="signup-country"
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                autoComplete="country"
                                className="field-input"
                                aria-describedby="signup-country-hint"
                              >
                                <option value="" disabled>
                                  {t("auth.errorCountry")}
                                </option>
                                {countries.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <p id="signup-country-hint" className="field-hint">
                                {t("auth.countryHint")}
                              </p>
                              <FormMessage className="field-error" />
                            </FormItem>
                          )}
                        />
                        <CustomInput control={form.control} name="firstName" label={t("auth.firstName")} placeholder={t("auth.firstNamePlaceholder")} autoComplete="given-name" />
                        <CustomInput control={form.control} name="lastName" label={t("auth.lastName")} placeholder={t("auth.lastNamePlaceholder")} autoComplete="family-name" />
                        {usIdentity && (
                          <>
                            <p className="text-13 text-ink-muted sm:col-span-2">{t("auth.usOnlyNote")}</p>
                            <DateInput control={form.control} name="dob" label={t("auth.dob")} hint={t("auth.dobHint")} />
                            <CustomInput
                              control={form.control}
                              name="ssn"
                              label={t("auth.taxId")}
                              placeholder={t("auth.taxIdPlaceholder")}
                              hint={t("auth.taxIdHint")}
                              autoComplete="off"
                              mono
                            />
                          </>
                        )}
                      </div>
                    </Section>
                  </div>

                  <div id="section-02" className="scroll-mt-6">
                    <Section title={t("auth.sectionAddress")} hint={t("auth.sectionAddressHint")}>
                      <div className="grid gap-4 sm:grid-cols-6">
                        <div className="sm:col-span-6">
                          <CustomInput control={form.control} name="address1" label={t("auth.street")} placeholder={t("auth.streetPlaceholder")} autoComplete="address-line1" />
                        </div>
                        <div className="sm:col-span-3">
                          <CustomInput control={form.control} name="city" label={t("auth.city")} placeholder={t("auth.cityPlaceholder")} autoComplete="address-level2" />
                        </div>
                        <div className="sm:col-span-1">
                          <CustomInput
                            control={form.control}
                            name="state"
                            label={regionRequired ? t("auth.state") : t("auth.stateOptional")}
                            placeholder={t("auth.statePlaceholder")}
                            autoComplete="address-level1"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <CustomInput
                            control={form.control}
                            name="postalCode"
                            label={regionRequired ? t("auth.postalCode") : t("auth.postalOptional")}
                            placeholder={t("auth.postalCodePlaceholder")}
                            autoComplete="postal-code"
                            mono
                          />
                        </div>
                      </div>
                    </Section>
                  </div>
                </>
              )}

              <div id="section-03" className="scroll-mt-6">
                <Section title={t("auth.sectionLogin")} hint={isSignUp ? t("auth.sectionLoginHint") : undefined}>
                  <CustomInput control={form.control} name="email" label={t("auth.email")} placeholder={t("auth.emailPlaceholder")} type="email" autoComplete="email" />
                  <CustomInput
                    control={form.control}
                    name="password"
                    label={t("auth.password")}
                    placeholder={isSignUp ? t("auth.passwordPlaceholderNew") : t("auth.passwordPlaceholder")}
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  {isSignUp && (
                    <>
                      <div className="flex items-center gap-2" aria-hidden="true">
                        {[1, 2, 3].map((level) => (
                          <span
                            key={level}
                            className={cn(
                              "h-1 flex-1 rounded-full bg-surface-container transition-colors",
                              strength >= level && (strength === 3 ? "bg-success" : strength === 2 ? "bg-warn" : "bg-danger")
                            )}
                          />
                        ))}
                        <span className={cn("eyebrow w-16 text-right", strength === 3 && "text-success", strength === 2 && "text-warn-ink", strength === 1 && "text-danger")}>
                          {["", t("auth.strengthWeak"), t("auth.strengthFair"), t("auth.strengthStrong")][strength]}
                        </span>
                      </div>
                      <CustomInput
                        control={form.control}
                        name="confirmPassword"
                        label={t("auth.confirmPassword")}
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        type="password"
                        autoComplete="new-password"
                      />

                      <FormField
                        control={form.control}
                        name="terms"
                        render={({ field }) => (
                          <FormItem className="field">
                            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface-low p-3 text-13 text-ink-muted">
                              <input
                                type="checkbox"
                                checked={Boolean(field.value)}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="mt-0.5 size-4 shrink-0 accent-[rgb(var(--primary))]"
                              />
                              <span>
                                {t("auth.termsBefore")}{" "}
                                <Link href="/terms" className="font-semibold text-ink underline underline-offset-4">
                                  {t("auth.termsLink")}
                                </Link>{" "}
                                {t("auth.termsAnd")}{" "}
                                <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
                                  {t("auth.privacyLink")}
                                </Link>
                                {t("auth.termsAfter")}
                              </span>
                            </label>
                            <FormMessage className="field-error" />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </Section>
              </div>

              <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              {errorMessage && (
                <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
                  {errorMessage}
                </p>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary h-12 w-full justify-between px-5">
                <span className="flex items-center gap-2">
                  <span className="size-2 bg-lime" />
                  {isLoading ? t("auth.working") : isSignUp ? t("auth.createAccountButton") : t("auth.signInButton")}
                </span>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              </button>
            </form>
          </Form>

          <footer className="flex items-center justify-between rounded-md border border-line bg-surface-low px-4 py-3 text-13 text-ink-muted">
            <span>{isSignUp ? t("auth.haveAccount") : t("auth.newToHorizon")}</span>
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-mono text-[12px] uppercase tracking-wider text-ink underline underline-offset-4">
              {isSignUp ? t("auth.signInButton") : t("auth.createAccountButton")}
            </Link>
          </footer>
        </>
      )}
    </section>
  );
};

export default AuthForm;
