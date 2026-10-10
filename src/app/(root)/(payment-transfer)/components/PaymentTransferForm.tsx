"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { useT } from "@/components/i18nProvider";
import { sendTransfer } from "@/lib/actions/transfer.action";
import type { Translate } from "@/lib/i18n/translate";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

import { BankDropdown } from "./BankDropdown";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "../ui/textarea";

// The same checks in the reader's language; the server checks everything again.
const makeSchema = (t: Translate) =>
  z.object({
    email: z.string().email(t("transfer.errEmailInvalid")),
    name: z.string().min(4, t("transfer.errNoteShort")),
    amount: z
      .string()
      .refine((v) => Number(v) > 0, t("transfer.formAmount")),
    senderBank: z.string().min(4, t("transfer.formSender")),
    sharableId: z.string().min(8, t("transfer.formReceivingCode")),
  });

type Values = z.infer<ReturnType<typeof makeSchema>>;

/** Puts data (money, names, emails) into a translated sentence at its {placeholder}, as its own element. */
const fill = (text: string, data: Record<string, ReactNode>) =>
  text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in data ? data[name] : part}</Fragment>;
  });

const Step = ({ index, title, hint, children }: { index: string; title: string; hint?: ReactNode; children: React.ReactNode }) => (
  <section className="panel">
    <header className="panel-head">
      <div className="flex items-center gap-3">
        <span className="flex-center h-6 min-w-6 rounded-sm bg-primary px-1.5 font-mono text-[12px] text-primary-foreground">{index}</span>
        <span className="font-display text-14 font-semibold uppercase tracking-tight text-ink">{title}</span>
      </div>
      {hint && <span className="eyebrow">{hint}</span>}
    </header>
    <div className="panel-body flex flex-col gap-4">{children}</div>
  </section>
);

const PaymentTransferForm = ({ accounts, initialId }: PaymentTransferFormProps) => {
  const router = useRouter();
  const t = useT();
  const formSchema = useMemo(() => makeSchema(t), [t]);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per transfer attempt: a retry after a network error reuses it, so the
  // server (and Dwolla) can tell it is the same transfer and not send it twice.
  const attemptKey = useRef<string | null>(null);
  // Money cannot be unsent: a filled-in form is shown back for a yes/no first.
  const [review, setReview] = useState<Values | null>(null);

  const defaultSender = accounts.find((a) => a.appwriteItemId === initialId) ?? accounts[0];

  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      amount: "",
      senderBank: defaultSender?.appwriteItemId ?? "",
      sharableId: "",
    },
  });

  const watched = form.watch();
  const source = accounts.find((a) => a.appwriteItemId === watched.senderBank) ?? defaultSender;
  const currency = source?.currency || "USD";
  const amountNumber = Number(watched.amount) || 0;
  const canSend = source?.provider === "plaid" || !source?.provider;

  const submit = async (data: Values) => {
    setReview(null);
    setIsLoading(true);
    setFormError(null);
    setNotice(null);

    try {
      attemptKey.current ??= crypto.randomUUID();
      // The server checks the sender, the recipient and the amount; the form only collects them.
      const result = await sendTransfer({ ...data, idempotencyKey: attemptKey.current });
      attemptKey.current = null; // answered: the next submit is a new transfer
      if (!result.ok) {
        if (result.field) form.setError(result.field, { message: result.error });
        else setFormError(result.error);
        return;
      }
      form.reset();
      if (result.warning) {
        setNotice(result.warning);
        return;
      }
      router.push("/");
    } catch {
      // No answer (network): keep the key, so trying again cannot send it twice.
      setFormError(t("common.notReachable"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => setReview(data))} className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
        {/* Locked while the user is asked to confirm, so what they confirm is what is sent. */}
        <fieldset disabled={review !== null || isLoading} className="flex min-w-0 flex-col gap-4">
          <Step
            index="1"
            title={t("transfer.stepFrom")}
            hint={source ? <span translate="no">{`${currency} · ${maskLabel(source.mask)}`}</span> : undefined}
          >
            <FormField
              control={form.control}
              name="senderBank"
              render={() => (
                <FormItem className="field">
                  <FormLabel className="field-label">{t("transfer.sendFrom")}</FormLabel>
                  <FormControl>
                    <BankDropdown accounts={accounts} setValue={form.setValue} initialId={defaultSender?.appwriteItemId} />
                  </FormControl>
                  {source && (
                    <p className="field-hint">
                      {t("transfer.available")}{" "}
                      <span translate="no" className="amount text-ink">
                        {formatAmount(source.currentBalance, currency)}
                      </span>
                    </p>
                  )}
                  {!canSend && (
                    <p className="field-error">{t("transfer.cannotSend")}</p>
                  )}
                  <FormMessage className="field-error" />
                </FormItem>
              )}
            />
          </Step>

          <Step index="2" title={t("transfer.stepTo")} hint={t("transfer.stepToHint")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="field">
                    <FormLabel className="field-label">{t("transfer.emailLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("transfer.emailPlaceholder")} className="field-input" autoComplete="off" translate="no" {...field} />
                    </FormControl>
                    <FormMessage className="field-error" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sharableId"
                render={({ field }) => (
                  <FormItem className="field">
                    <FormLabel className="field-label">{t("transfer.receivingCodeLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("transfer.receivingCodePlaceholder")} className="field-input font-mono" translate="no" {...field} />
                    </FormControl>
                    <FormMessage className="field-error" />
                  </FormItem>
                )}
              />
            </div>
            <p className="field-hint">{t("transfer.receivingCodeHint")}</p>
          </Step>

          <Step index="3" title={t("transfer.stepAmount")} hint={t("transfer.amountHint", { currency })}>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="field">
                  <FormLabel className="field-label">{t("transfer.amountLabel")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3 rounded-md border border-line bg-surface-low px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                      <span translate="no" className="eyebrow text-ink">
                        {currency}
                      </span>
                      <Input
                        placeholder="0.00"
                        translate="no"
                        inputMode="decimal"
                        className="amount h-14 flex-1 border-0 bg-transparent px-0 text-28 font-semibold shadow-none focus-visible:ring-0"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="field-error" />
                </FormItem>
              )}
            />
          </Step>

          <Step index="4" title={t("transfer.stepNote")} hint={t("transfer.stepNoteHint")}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="field">
                  <FormLabel className="field-label">{t("transfer.noteLabel")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("transfer.notePlaceholder")} className="field-input min-h-24 py-3" {...field} />
                  </FormControl>
                  <FormMessage className="field-error" />
                </FormItem>
              )}
            />
          </Step>
        </fieldset>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-0">
          <section className="panel">
            <header className="panel-head">
              <span className="eyebrow">{t("transfer.summary")}</span>
              <span className="chip">
                <span className="dot bg-lime" />
                {t("transfer.live")}
              </span>
            </header>
            <dl className="panel-body flex flex-col divide-y divide-line [&>div]:flex [&>div]:items-start [&>div]:justify-between [&>div]:gap-4 [&>div]:py-2.5">
              <div>
                <dt className="eyebrow">{t("transfer.from")}</dt>
                <dd translate="no" className="text-right text-14 font-semibold text-ink">
                  {source ? `${source.name} ${maskLabel(source.mask)}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{t("transfer.to")}</dt>
                <dd translate="no" className="max-w-[60%] truncate text-right text-14 font-semibold text-ink">{watched.email || "—"}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t("transfer.amount")}</dt>
                <dd translate="no" className="amount text-right text-18 font-semibold text-ink">{formatAmount(amountNumber, currency)}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t("transfer.fee")}</dt>
                <dd className="text-right text-14 text-success">{t("transfer.feeNone")}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t("transfer.arrives")}</dt>
                <dd className="text-right text-14 text-ink-muted">{t("transfer.arrivesValue")}</dd>
              </div>
            </dl>
          </section>

          {formError && (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
              {formError}
            </p>
          )}
          {notice && (
            <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-13 text-warn-ink" role="status">
              {notice}
            </p>
          )}

          {review ? (
            <section className="panel border-primary" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
              <div className="panel-body flex flex-col gap-3">
                <h2 id="confirm-title" className="font-display text-16 font-semibold text-ink">
                  {fill(t("transfer.confirmTitle"), { amount: <span translate="no">{formatAmount(Number(review.amount), currency)}</span> })}
                </h2>
                <p id="confirm-body" className="text-14 text-ink-muted">
                  {fill(t("transfer.confirmBody"), {
                    from: (
                      <span translate="no" className="font-semibold text-ink">
                        {source ? `${source.name} ${maskLabel(source.mask)}` : "—"}
                      </span>
                    ),
                    to: (
                      <span translate="no" className="font-semibold text-ink">
                        {review.email}
                      </span>
                    ),
                  })}
                </p>
                <button type="button" autoFocus onClick={() => submit(review)} className="btn-primary h-12 w-full">
                  {fill(t("transfer.confirmYes"), { amount: <span translate="no">{formatAmount(Number(review.amount), currency)}</span> })}
                </button>
                <button type="button" onClick={() => setReview(null)} className="btn-secondary w-full">
                  {t("transfer.confirmNo")}
                </button>
              </div>
            </section>
          ) : (
            <>
              <button type="submit" disabled={isLoading || !canSend} className={cn("btn-primary h-12 w-full")}>
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("transfer.sending")}
                  </>
                ) : (
                  <>
                    {t("transfer.review")} <ArrowRight className="size-4" />
                  </>
                )}
              </button>
              <p className="eyebrow text-center">{t("transfer.reviewHint")}</p>
            </>
          )}
        </aside>
      </form>
    </Form>
  );
};

export default PaymentTransferForm;
