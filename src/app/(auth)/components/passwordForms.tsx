"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { requestPasswordReset, setNewPassword } from "@/lib/actions/user.action";

const Header = ({ eyebrow, heading, intro }: { eyebrow: string; heading: string; intro: string }) => (
  <header className="flex flex-col gap-2">
    <p className="eyebrow">{eyebrow}</p>
    <h1 className="h-display">{heading}</h1>
    <p className="text-14 text-ink-muted">{intro}</p>
  </header>
);

const Submit = ({ busy, label }: { busy: boolean; label: string }) => {
  const t = useT();
  return (
    <button type="submit" disabled={busy} className="btn-primary h-12 w-full justify-between px-5">
      <span className="flex items-center gap-2">
        <span className="size-2 bg-lime" />
        {busy ? t("auth.working") : label}
      </span>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
    </button>
  );
};

const Problem = ({ text }: { text: string | null }) =>
  text ? (
    <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
      {text}
    </p>
  ) : null;

/** "Forgot password": asks for the email, always gives the same answer. */
export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(expired ? t("auth.forgotExpired") : null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await requestPasswordReset({ email });
      if (result.ok) setSent(true);
      else setProblem(result.error);
    } catch {
      setProblem(t("common.tryAgain"));
    }
    setBusy(false);
  };

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <Header eyebrow={t("auth.eyebrowForgot")} heading={t("auth.headingForgot")} intro={t("auth.introForgot")} />
      {sent ? (
        <p className="rounded-md border border-line bg-surface-low px-4 py-3 text-14 text-ink" role="status">
          {t("auth.forgotSent")}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="field">
            <label className="field-label" htmlFor="forgot-email">
              {t("auth.email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              maxLength={256}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="field-input"
            />
          </div>
          <Problem text={problem} />
          <Submit busy={busy} label={t("auth.sendLinkButton")} />
        </form>
      )}
      <Link href="/sign-in" className="self-start font-mono text-[12px] uppercase tracking-wider text-ink-muted underline underline-offset-4 hover:text-ink">
        {t("auth.backToSignIn")}
      </Link>
    </section>
  );
}

/** "Set a new password", after following the emailed link (which signed the person in). */
export function ResetPasswordForm({ email }: { email: string }) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) return setProblem(t("auth.errorPasswordsDiffer"));
    setBusy(true);
    setProblem(null);
    try {
      const result = await setNewPassword({ password });
      if (result.ok) setDone(true);
      else setProblem(result.error);
    } catch {
      setProblem(t("common.tryAgain"));
    }
    setBusy(false);
  };

  return (
    <section className="flex w-full max-w-[560px] flex-col gap-8">
      <Header eyebrow={t("auth.eyebrowReset")} heading={t("auth.headingReset")} intro={t("auth.introReset", { email })} />
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-line bg-surface-low px-4 py-3 text-14 text-ink" role="status">
            {t("auth.resetDone")}
          </p>
          <button type="button" onClick={() => router.push("/")} className="btn-primary h-12 w-full justify-between px-5">
            {t("auth.goToHorizon")} <ArrowRight className="size-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          {/* Lets password managers save the new password for the right account. */}
          <input type="email" value={email} autoComplete="username" readOnly hidden />
          <div className="field">
            <label className="field-label" htmlFor="reset-password">
              {t("auth.newPassword")}
            </label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholderNew")}
              className="field-input"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reset-confirm">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="reset-confirm"
              type="password"
              required
              maxLength={128}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              className="field-input"
            />
          </div>
          <Problem text={problem} />
          <Submit busy={busy} label={t("auth.saveNewPassword")} />
        </form>
      )}
    </section>
  );
}
