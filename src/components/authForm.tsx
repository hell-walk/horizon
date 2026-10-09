"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { signIn, signUp } from "@/lib/actions/user.action";
import { authFormSchema, cn } from "@/lib/utils";

import CustomInput from "./customInput";
import ImportStatement from "./importStatement";
import PlaidLink from "./plaidLink";
import SetuLink from "./setuLink";

const SECTIONS = [
  { index: "01", title: "Identity" },
  { index: "02", title: "Address" },
  { index: "03", title: "Credentials" },
];

const Section = ({ index, title, hint, children }: { index: string; title: string; hint?: string; children: React.ReactNode }) => (
  <fieldset className="flex flex-col gap-4">
    <legend className="mb-4 flex w-full items-center justify-between border-b border-line pb-2">
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-faint">{index}</span>
        <span className="font-display text-13 font-semibold uppercase tracking-wide text-ink">{title}</span>
      </span>
      {hint && <span className="eyebrow">{hint}</span>}
    </legend>
    {children}
  </fieldset>
);

// Three-level strength bar: length, a digit, a symbol or capital.
const strengthOf = (password: string) =>
  [password.length >= 8, /\d/.test(password), /[^A-Za-z0-9]/.test(password) || /[A-Z]/.test(password)].filter(Boolean).length;

const AuthForm = ({ type }: { type: string }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSignUp = type === "sign-up";
  const formSchema = authFormSchema(type);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
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
          firstName: data.firstName!,
          lastName: data.lastName!,
          address1: data.address1!,
          city: data.city!,
          state: data.state!,
          postalCode: data.postalCode!,
          dateOfBirth: data.dob!,
          ssn: data.ssn!,
          email: data.email,
          password: data.password,
        });

        if (!newUser) setErrorMessage("We could not create your account. Check the details and try again.");
        setUser(newUser);
      } else {
        const response = await signIn({ email: data.email, password: data.password });
        if (response) router.push("/");
        else setErrorMessage("Invalid email or password.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{user ? "Step 02 // link an account" : isSignUp ? "Registration" : "Access"}</p>
        <h1 className="h-display">{user ? "Link your first bank" : isSignUp ? "Create your account" : "Sign in"}</h1>
        <p className="text-14 text-ink-muted">
          {user
            ? "Connect a bank now or skip and do it later from the Connect Bank page."
            : isSignUp
              ? "A few details to open your ledger. Nothing is shared with banks until you connect one."
              : "Enter your email and password to open your accounts."}
        </p>
      </header>

      {user ? (
        <div className="flex flex-col gap-3">
          <PlaidLink user={user} variant="primary" />
          <SetuLink user={user} variant="primary" />
          <ImportStatement variant="primary" />
          <Link href="/" className="btn-ghost">
            Skip for now <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          {isSignUp && (
            <nav className="grid grid-cols-3 gap-1" aria-label="Form sections">
              {SECTIONS.map((s) => (
                <a
                  key={s.index}
                  href={`#section-${s.index}`}
                  className="flex items-center justify-center gap-2 rounded-sm border border-line bg-card py-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:bg-surface-container"
                >
                  <span className="text-ink-faint">{s.index}</span> {s.title}
                </a>
              ))}
            </nav>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8" noValidate>
              {isSignUp && (
                <>
                  <div id="section-01" className="scroll-mt-6">
                    <Section index="01" title="Identity" hint="As on your ID">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <CustomInput control={form.control} name="firstName" label="First name" placeholder="Alex" autoComplete="given-name" />
                        <CustomInput control={form.control} name="lastName" label="Last name" placeholder="Sharma" autoComplete="family-name" />
                        <CustomInput control={form.control} name="dob" label="Date of birth" placeholder="YYYY-MM-DD" hint="YYYY-MM-DD" autoComplete="bday" mono />
                        <CustomInput control={form.control} name="ssn" label="SSN / tax id" placeholder="Last 4 digits" hint="Sandbox: 1234" autoComplete="off" mono />
                      </div>
                    </Section>
                  </div>

                  <div id="section-02" className="scroll-mt-6">
                    <Section index="02" title="Address" hint="Billing address">
                      <div className="grid gap-4 sm:grid-cols-6">
                        <div className="sm:col-span-6">
                          <CustomInput control={form.control} name="address1" label="Street address" placeholder="12 Market Street" autoComplete="address-line1" />
                        </div>
                        <div className="sm:col-span-3">
                          <CustomInput control={form.control} name="city" label="City" placeholder="Mumbai" autoComplete="address-level2" />
                        </div>
                        <div className="sm:col-span-1">
                          <CustomInput control={form.control} name="state" label="State" placeholder="MH" autoComplete="address-level1" />
                        </div>
                        <div className="sm:col-span-2">
                          <CustomInput control={form.control} name="postalCode" label="Postal code" placeholder="400001" autoComplete="postal-code" mono />
                        </div>
                      </div>
                    </Section>
                  </div>
                </>
              )}

              <div id="section-03" className="scroll-mt-6">
                <Section index={isSignUp ? "03" : "01"} title="Credentials" hint={isSignUp ? "Min. 8 characters" : undefined}>
                  <CustomInput control={form.control} name="email" label="Email address" placeholder="name@example.com" type="email" autoComplete="email" />
                  <CustomInput
                    control={form.control}
                    name="password"
                    label="Password"
                    placeholder={isSignUp ? "Create a password" : "Your password"}
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  {isSignUp && (
                    <>
                      <div className="flex items-center gap-2" aria-hidden="true">
                        {[1, 2, 3].map((level) => (
                          <span
                            key={level}
                            className={cn("h-1 flex-1 rounded-full bg-surface-container transition-colors", strength >= level && (strength === 3 ? "bg-lime" : "bg-warn"))}
                          />
                        ))}
                        <span className="eyebrow w-16 text-right">{["Weak", "Weak", "Fair", "Strong"][strength]}</span>
                      </div>
                      <CustomInput control={form.control} name="confirmPassword" label="Confirm password" placeholder="Repeat the password" type="password" autoComplete="new-password" />

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
                                I agree to the{" "}
                                <Link href="/terms" className="font-semibold text-ink underline underline-offset-4">
                                  terms
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
                                  privacy policy
                                </Link>
                                , and to Horizon reading account data I choose to connect.
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
                  {isLoading ? "Working" : isSignUp ? "Create account" : "Sign in"}
                </span>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              </button>
            </form>
          </Form>

          <footer className="flex items-center justify-between rounded-md border border-line bg-surface-low px-4 py-3 text-13 text-ink-muted">
            <span>{isSignUp ? "Already have an account?" : "New to Horizon?"}</span>
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-mono text-[11px] uppercase tracking-wider text-ink underline underline-offset-4">
              {isSignUp ? "Sign in" : "Create account"}
            </Link>
          </footer>
        </>
      )}
    </section>
  );
};

export default AuthForm;
