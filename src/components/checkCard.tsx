"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useT } from "@/components/i18nProvider";
import { answerCheck } from "@/lib/actions/checks.action";

export type CheckOption = { value: string; label: string; tone?: "primary" | "secondary" | "ghost" };

/** One question and its answers. The words come from the server; a tap sends the key and the answer back, and the next question comes with the refresh. */
const CheckCard = ({ id, question, options }: { id: string; question: string; options: CheckOption[] }) => {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answer = async (value: string) => {
    setBusy(value);
    setError(null);
    try {
      const result = await answerCheck({ key: id, answer: value });
      if (result.ok) startTransition(() => router.refresh());
      else setError(result.error);
    } catch {
      setError(t("common.notReachable"));
    }
    setBusy(null);
  };

  const working = busy !== null || pending;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-14 text-ink">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => answer(option.value)}
            disabled={working}
            className={`btn-${option.tone ?? "secondary"} btn-sm`}
          >
            {busy === option.value && <Loader2 className="size-3.5 animate-spin" />} {option.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default CheckCard;
