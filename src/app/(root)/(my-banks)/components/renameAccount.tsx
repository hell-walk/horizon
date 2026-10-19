"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18nProvider";
import { renameAccount } from "@/lib/actions/card.action";

/**
 * The name of an imported account, with a pencil to change it: a statement
 * that did not say which bank it was from is saved as "My Bank", and the name
 * is what later uploads are matched on.
 */
const RenameAccount = ({ appwriteItemId, name }: { appwriteItemId: string; name: string }) => {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await renameAccount({ appwriteItemId, name: value });
      if (result.ok) {
        setEditing(false);
        startTransition(() => router.refresh());
      } else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(false);
  };

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <h2 translate="no" className="font-display text-20 font-semibold tracking-tight text-ink">
          {name}
        </h2>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          aria-label={t("banks.rename")}
          title={t("banks.rename")}
          className="flex-center size-7 rounded-full text-ink-muted transition-colors hover:bg-surface-low hover:text-ink"
        >
          <Pencil className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          autoFocus
          translate="no"
          aria-label={t("banks.rename")}
          className="field-input max-w-xs"
          aria-describedby={error ? `rename-error-${appwriteItemId}` : undefined}
        />
        <button type="submit" disabled={value.trim().length < 2 || busy || pending} className="btn-primary btn-sm" aria-label={t("banks.renameSave")}>
          {busy || pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm" aria-label={t("banks.renameCancel")}>
          <X className="size-3.5" />
        </button>
      </div>
      {error && (
        <p id={`rename-error-${appwriteItemId}`} role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
};

export default RenameAccount;
