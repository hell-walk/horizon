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
import { completeProfile, logoutAccount, signIn, signInWithGoogle, signUp } from "@/lib/actions/user.action";
import { countryList, needsStateAndPostal, needsUsIdentity } from "@/lib/countries";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { authFormSchema, cn } from "@/lib/utils";

import CustomInput from "./customInput";
import DateInput from "./dateInput";
import PasswordRules from "./passwordRules";
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

// Google's "G", in its colours (Google's sign-in button guidelines ask for it).
const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
    />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * type: "sign-in", "sign-up", or "welcome" (signed in with Google, finishing
 * the profile; `email` is the Google account's). `notice`: a message to show
 * first, e.g. when coming back from Google did not work.
 */
const AuthForm = ({ type, email, notice, defaults }: { type: string; email?: string; notice?: string; defaults?: Partial<Record<string, string>> }) => {
  const t = useT();
  const locale = useLocale();
  const countries = useMemo(() => countryList(LOCALE_TAGS[locale]), [locale]);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  // After sign-up: the address the confirmation link went to.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(notice ?? null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const isSignUp = type === "sign-up";
  const isWelcome = type === "welcome";
  const asksProfile = isSignUp || isWelcome;
  const formSchema = authFormSchema(type, t);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
      country: defaults?.country ?? "",
      firstName: defaults?.firstName ?? "",
      lastName: defaults?.lastName ?? "",
      address1: defaults?.address1 ?? "",
      city: defaults?.city ?? "",
      state: defaults?.state ?? "",
      postalCode: defaults?.postalCode ?? "",
      dob: "",
      ssn: "",
    },
  });

  const password = form.watch("password") ?? "";
  const typedEmail = form.watch("email") ?? "";
  const country = form.watch("country") ?? "";
  // The US partner's questions come after the email is confirmed, on the welcome step.
  const usIdentity = needsUsIdentity(country) && isWelcome;
  const regionRequired = needsStateAndPostal(country);
  const strength = strengthOf(password);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Honeypot: real users never fill the hidden field, bots usually do.
    const trap = (document.getElementById("company-website") as HTMLInputElement | null)?.value;
    if (trap) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isWelcome) {
        const done = await completeProfile({
          country: data.country!,
          firstName: data.firstName!,
          lastName: data.lastName!,
          address1: data.address1!,
          city: data.city!,
          state: data.state ?? "",
          postalCode: data.postalCode ?? "",
          dateOfBirth: needsUsIdentity(data.country ?? "") ? (data.dob ?? "") : "",
          ssn: needsUsIdentity(data.country ?? "") ? (data.ssn ?? "") : "",
          terms: Boolean(data.terms),
        });
        if (!done.ok) setErrorMessage(done.error);
        else if (done.user) setUser(done.user);
        else router.push("/");
      } else if (isSignUp) {
        const newUser = await signUp({
          country: data.country!,
          firstName: data.firstName!,
          lastName: data.lastName!,
          address1: data.address1!,
          city: data.city!,
          state: data.state ?? "",
          postalCode: data.postalCode ?? "",
          // Asked after the email is confirmed (welcome step), never at sign-up.
          dateOfBirth: "",
          ssn: "",
          email: data.email!,
          password: data.password!,
        });

        if (!newUser.ok) setErrorMessage(newUser.error);
        else setSentTo(data.email!.trim());
      } else {
        const response = await signIn({ email: data.email!, password: data.password! });
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

  // Google sends the person back to /auth/callback, then on to the app (or /welcome).
  const continueWithGoogle = async () => {
    setGoogleBusy(true);
    setErrorMessage(null);
    try {
      const result = await signInWithGoogle();
      if (result.ok) {
        window.location.assign(result.url);
        return; // stays busy while the browser leaves
      }
      setErrorMessage(result.error);
    } catch {
      setErrorMessage(t("auth.errorGoogle"));
    }
    setGoogleBusy(false);
  };

  const useDifferentAccount = async () => {
    await logoutAccount();
    router.push("/sign-in");
  };

  const termsField = (
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
  );

  const eyebrow = sentTo
    ? "auth.eyebrowCheckEmail"
    : user
      ? "auth.eyebrowNextStep"
      : isWelcome
        ? "auth.eyebrowWelcome"
        : isSignUp
          ? "auth.eyebrowSignUp"
          : "auth.eyebrowSignIn";
  const heading = sentTo
    ? "auth.headingCheckEmail"
    : user
      ? "auth.headingAddBank"
      : isWelcome
        ? "auth.headingWelcome"
        : isSignUp
          ? "auth.headingSignUp"
          : "auth.headingSignIn";
  const intro = sentTo
    ? t("auth.introCheckEmail", { email: sentTo })
    : user
      ? t("auth.introAddBank")
      : isWelcome
        ? t("auth.introWelcome", { email: email ?? "" })
        : isSignUp
          ? t("auth.introSignUp")
          : t("auth.introSignIn");
  const submitLabel = isWelcome ? t("auth.finishButton") : isSignUp ? t("auth.createAccountButton") : t("auth.signInButton");

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t(eyebrow)}</p>
        <h1 className="h-display">{t(heading)}</h1>
        <p className="text-14 text-ink-muted">{intro}</p>
      </header>

      {sentTo ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-line bg-surface-low px-4 py-3 text-14 text-ink" role="status">
            {t("auth.checkEmailHelp")}
          </p>
          <Link href="/sign-in" className="btn-ghost">
            {t("auth.backToSignIn")} <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : user ? (
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
          {!isWelcome && (
            <>
              <button type="button" onClick={continueWithGoogle} disabled={googleBusy || isLoading} className="btn-ghost h-12 w-full justify-center gap-3">
                {googleBusy ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
                {t("auth.continueWithGoogle")}
              </button>
              <div className="flex items-center gap-3 text-13 text-ink-muted" role="separator">
                <span className="h-px flex-1 bg-line" />
                {t("auth.orDivider")}
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          {asksProfile && (
            <nav className={cn("grid gap-1", isWelcome ? "grid-cols-2" : "grid-cols-3")} aria-label={t("auth.formSections")}>
              {(isWelcome ? SECTIONS.slice(0, 2) : SECTIONS).map((s) => (
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
              {asksProfile && (
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
                        <CustomInput
                          control={form.control}
                          name="firstName"
                          label={t("auth.firstName")}
                          placeholder={t("auth.firstNamePlaceholder")}
                          autoComplete="given-name"
                        />
                        <CustomInput
                          control={form.control}
                          name="lastName"
                          label={t("auth.lastName")}
                          placeholder={t("auth.lastNamePlaceholder")}
                          autoComplete="family-name"
                        />
                        {isSignUp && needsUsIdentity(country) && <p className="text-13 text-ink-muted sm:col-span-2">{t("auth.usLaterNote")}</p>}
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
                          <CustomInput
                            control={form.control}
                            name="address1"
                            label={t("auth.street")}
                            placeholder={t("auth.streetPlaceholder")}
                            autoComplete="address-line1"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <CustomInput
                            control={form.control}
                            name="city"
                            label={t("auth.city")}
                            placeholder={t("auth.cityPlaceholder")}
                            autoComplete="address-level2"
                          />
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

              {isWelcome && termsField}

              {!isWelcome && (
                <div id="section-03" className="scroll-mt-6">
                  <Section title={t("auth.sectionLogin")} hint={isSignUp ? t("auth.sectionLoginHint") : undefined}>
                    <CustomInput
                      control={form.control}
                      name="email"
                      label={t("auth.email")}
                      placeholder={t("auth.emailPlaceholder")}
                      type="email"
                      autoComplete="email"
                    />
                    <CustomInput
                      control={form.control}
                      name="password"
                      label={t("auth.password")}
                      placeholder={isSignUp ? t("auth.passwordPlaceholderNew") : t("auth.passwordPlaceholder")}
                      type="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                    />
                    {!isSignUp && (
                      <Link href="/forgot-password" className="-mt-2 self-end text-13 text-ink-muted underline underline-offset-4 hover:text-ink">
                        {t("auth.forgotPasswordLink")}
                      </Link>
                    )}
                    {isSignUp && (
                      <>
                        <div className="flex items-center gap-2" aria-hidden="true">
                          {[1, 2, 3].map((level) => (
                            <span
                              key={level}
                              className={cn(
                                "h-1 flex-1 rounded-full bg-surface-container transition-colors",
                                strength >= level && (strength === 3 ? "bg-success" : strength === 2 ? "bg-warn" : "bg-danger"),
                              )}
                            />
                          ))}
                          <span
                            className={cn(
                              "eyebrow w-16 text-right",
                              strength === 3 && "text-success",
                              strength === 2 && "text-warn-ink",
                              strength === 1 && "text-danger",
                            )}
                          >
                            {["", t("auth.strengthWeak"), t("auth.strengthFair"), t("auth.strengthStrong")][strength]}
                          </span>
                        </div>
                        <PasswordRules password={password} email={typedEmail} />
                        <CustomInput
                          control={form.control}
                          name="confirmPassword"
                          label={t("auth.confirmPassword")}
                          placeholder={t("auth.confirmPasswordPlaceholder")}
                          type="password"
                          autoComplete="new-password"
                        />

                        {termsField}
                      </>
                    )}
                  </Section>
                </div>
              )}

              <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              {errorMessage && (
                <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
                  {errorMessage}
                </p>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary h-12 w-full justify-between px-5">
                <span className="flex items-center gap-2">
                  <span className="size-2 bg-lime" />
                  {isLoading ? t("auth.working") : submitLabel}
                </span>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              </button>
            </form>
          </Form>

          {isWelcome ? (
            <button
              type="button"
              onClick={useDifferentAccount}
              className="self-start font-mono text-[12px] uppercase tracking-wider text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              {t("auth.useDifferentAccount")}
            </button>
          ) : (
            <footer className="flex items-center justify-between rounded-md border border-line bg-surface-low px-4 py-3 text-13 text-ink-muted">
              <span>{isSignUp ? t("auth.haveAccount") : t("auth.newToHorizon")}</span>
              <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-mono text-[12px] uppercase tracking-wider text-ink underline underline-offset-4">
                {isSignUp ? t("auth.signInButton") : t("auth.createAccountButton")}
              </Link>
            </footer>
          )}
        </>
      )}
    </section>
  );
};

export default AuthForm;
