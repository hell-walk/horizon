"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import { Control, FieldPath } from "react-hook-form";
import z from "zod";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authFormSchema } from "@/lib/utils";

const formSchema = authFormSchema("sign-up");
type Values = z.infer<typeof formSchema>;

// Keeps only digits and inserts the dashes of YYYY-MM-DD as the user types.
export const maskDate = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  let out = y;
  if (digits.length > 4) out += `-${m}`;
  if (digits.length > 6) out += `-${d}`;
  return out;
};

type Props = {
  control: Control<Values>;
  name: FieldPath<Values>;
  label: string;
  hint?: string;
};

/**
 * Date of birth: type the digits and the dashes appear by themselves
 * (2001-04-23), or open the calendar with the button. Both write the same
 * YYYY-MM-DD string the server expects.
 */
const DateInput = ({ control, name, label, hint }: Props) => {
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="field">
          <div className="flex items-center justify-between">
            <FormLabel className="field-label">{label}</FormLabel>
            {hint && <span className="eyebrow">{hint}</span>}
          </div>
          <div className="relative">
            <FormControl>
              <Input
                placeholder="YYYY-MM-DD"
                inputMode="numeric"
                autoComplete="bday"
                maxLength={10}
                className="field-input pr-11 font-mono"
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(e) => field.onChange(maskDate(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>

            <button
              type="button"
              onClick={openPicker}
              aria-label="Open calendar"
              className="absolute right-1 top-1/2 flex-center size-9 -translate-y-1/2 rounded-sm text-ink-faint hover:text-ink"
            >
              <CalendarDays className="size-4" />
            </button>

            {/* Native date picker, visually hidden; its value is mirrored into the text field. */}
            <input
              ref={pickerRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              max={new Date().toISOString().slice(0, 10)}
              value={typeof field.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(field.value) ? field.value : ""}
              onChange={(e) => field.onChange(e.target.value)}
              className="pointer-events-none absolute bottom-0 right-2 size-0 opacity-0"
            />
          </div>
          <FormMessage className="field-error" />
        </FormItem>
      )}
    />
  );
};

export default DateInput;
