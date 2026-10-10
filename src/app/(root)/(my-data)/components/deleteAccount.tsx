"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/i18nProvider";
import { Input } from "@/components/ui/input";
import { deleteMyAccount } from "@/lib/actions/privacy.action";

/**
 * Deleting the account needs a tick and the password, then signs out. A Google
 * login has no password: it types its email, soon after signing in.
 */
const DeleteAccount = ({ hasPassword }: { hasPassword: boolean }) => {
  const t = useT();
  const router = useRouter();
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await deleteMyAccount(hasPassword ? { password } : { email: password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The session cookie is gone, so the sign-in page is all that is left.
      router.replace("/sign-in");
    } catch {
      setError(t("common.notReachable"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel border-danger/40" aria-labelledby="delete-title">
      <form onSubmit={submit} className="panel-body flex flex-col gap-3">
        <h2 id="delete-title" className="flex items-center gap-2 font-display text-18 font-semibold text-danger">
          <AlertTriangle className="size-5" aria-hidden /> {t("data.deleteTitle")}
        </h2>
        <p className="text-14 text-ink">{t("data.deleteBody")}</p>
        <p className="text-13 text-ink-muted">{t("data.deleteKeeps")}</p>

        <label className="flex items-start gap-2 text-14 text-ink">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 size-4" />
          {t("data.deleteUnderstand")}
        </label>

        <div className="field max-w-sm">
          <label className="field-label" htmlFor="delete-password">
            {hasPassword ? t("data.deletePassword") : t("data.deleteEmail")}
          </label>
          <Input
            id="delete-password"
            type={hasPassword ? "password" : "email"}
            autoComplete={hasPassword ? "current-password" : "off"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            aria-describedby="delete-password-hint"
          />
          <p id="delete-password-hint" className="field-hint">
            {hasPassword ? t("data.deletePasswordHint") : t("data.deleteEmailHint")}
          </p>
        </div>

        <button type="submit" disabled={!understood || !password || busy} className="btn-primary w-fit bg-danger text-white hover:bg-danger/90">
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? t("data.deleteWorking") : t("data.deleteButton")}
        </button>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
};

export default DeleteAccount;
