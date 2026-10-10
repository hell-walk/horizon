"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { sendTransfer } from "@/lib/actions/transfer.action";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

import { BankDropdown } from "./BankDropdown";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const formSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().min(4, "Add a short note (at least 4 characters)"),
  amount: z
    .string()
    .refine((v) => Number(v) > 0, "Enter an amount greater than zero"),
  senderBank: z.string().min(4, "Choose the account to send from"),
  sharableId: z.string().min(8, "Paste the recipient's sharable id"),
});

type Values = z.infer<typeof formSchema>;

const Step = ({ index, title, hint, children }: { index: string; title: string; hint?: string; children: React.ReactNode }) => (
  <section className="panel">
    <header className="panel-head">
      <div className="flex items-center gap-3">
        <span className="flex-center h-6 min-w-6 rounded-sm bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">{index}</span>
        <span className="font-display text-14 font-semibold uppercase tracking-tight text-ink">{title}</span>
      </div>
      {hint && <span className="eyebrow">{hint}</span>}
    </header>
    <div className="panel-body flex flex-col gap-4">{children}</div>
  </section>
);

const PaymentTransferForm = ({ accounts, initialId }: PaymentTransferFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setIsLoading(true);
    setFormError(null);

    try {
      // The server checks the sender, the recipient and the amount; the form only collects them.
      const result = await sendTransfer(data);
      if (!result.ok) {
        if (result.field) form.setError(result.field, { message: result.error });
        else setFormError(result.error);
        return;
      }
      form.reset();
      router.push("/");
    } catch (error) {
      console.error("Submitting create transfer request failed: ", error);
      setFormError("Something went wrong while sending the transfer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="flex flex-col gap-4">
          <Step index="01" title="Source account" hint={source ? `${currency} · ${maskLabel(source.mask)}` : undefined}>
            <FormField
              control={form.control}
              name="senderBank"
              render={() => (
                <FormItem className="field">
                  <FormLabel className="field-label">Send from</FormLabel>
                  <FormControl>
                    <BankDropdown accounts={accounts} setValue={form.setValue} initialId={defaultSender?.appwriteItemId} />
                  </FormControl>
                  {source && (
                    <p className="field-hint">
                      Available: <span className="amount text-ink">{formatAmount(source.currentBalance, currency)}</span>
                    </p>
                  )}
                  {!canSend && (
                    <p className="field-error">
                      Transfers run on the Dwolla sandbox, so only Plaid-linked US accounts can send money.
                    </p>
                  )}
                  <FormMessage className="field-error" />
                </FormItem>
              )}
            />
          </Step>

          <Step index="02" title="Recipient" hint="Horizon user">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="field">
                    <FormLabel className="field-label">Recipient email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" className="field-input" autoComplete="off" {...field} />
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
                    <FormLabel className="field-label">Recipient sharable id</FormLabel>
                    <FormControl>
                      <Input placeholder="Paste the id from their bank card" className="field-input font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="field-error" />
                  </FormItem>
                )}
              />
            </div>
            <p className="field-hint">The recipient copies their sharable id from any bank card on their Horizon account.</p>
          </Step>

          <Step index="03" title="Amount" hint={`${currency} · fixed`}>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="field">
                  <FormLabel className="field-label">Amount to send</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3 rounded-md border border-line bg-surface-low px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                      <span className="eyebrow text-ink">{currency}</span>
                      <Input
                        placeholder="0.00"
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

          <Step index="04" title="Note" hint="Shown to both parties">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="field">
                  <FormLabel className="field-label">Transfer note</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this transfer for?" className="field-input min-h-24 py-3" {...field} />
                  </FormControl>
                  <FormMessage className="field-error" />
                </FormItem>
              )}
            />
          </Step>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-0">
          <section className="panel">
            <header className="panel-head">
              <span className="eyebrow">Summary</span>
              <span className="chip">
                <span className="dot bg-lime" />
                Live
              </span>
            </header>
            <dl className="panel-body flex flex-col divide-y divide-line [&>div]:flex [&>div]:items-start [&>div]:justify-between [&>div]:gap-4 [&>div]:py-2.5">
              <div>
                <dt className="eyebrow">From</dt>
                <dd className="text-right text-14 font-semibold text-ink">
                  {source ? `${source.name} ${maskLabel(source.mask)}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">To</dt>
                <dd className="max-w-[60%] truncate text-right text-14 font-semibold text-ink">{watched.email || "—"}</dd>
              </div>
              <div>
                <dt className="eyebrow">Amount</dt>
                <dd className="amount text-right text-18 font-semibold text-ink">{formatAmount(amountNumber, currency)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Fee</dt>
                <dd className="text-right text-14 text-success">None</dd>
              </div>
              <div>
                <dt className="eyebrow">Settlement</dt>
                <dd className="text-right text-14 text-ink-muted">Dwolla sandbox · same day</dd>
              </div>
            </dl>
          </section>

          {formError && (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-13 text-danger" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" disabled={isLoading || !canSend} className={cn("btn-primary h-12 w-full")}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Sending
              </>
            ) : (
              <>
                Authorize and send <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <p className="eyebrow text-center">Transfers are final once sent</p>
        </aside>
      </form>
    </Form>
  );
};

export default PaymentTransferForm;
