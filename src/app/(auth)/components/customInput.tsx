"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Control, FieldPath } from "react-hook-form";
import z from "zod";

import { useT } from "@/components/i18nProvider";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authFormSchema } from "@/lib/utils";

type Values = z.infer<ReturnType<typeof authFormSchema>>;

interface CustomInputProps {
  control: Control<Values>;
  name: FieldPath<Values>;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  mono?: boolean;
}

// Labelled input with inline error. Password fields get a show/hide toggle.
const CustomInput = ({ control, name, label, placeholder, type = "text", autoComplete, hint, mono = false }: CustomInputProps) => {
  const t = useT();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

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
                placeholder={placeholder}
                type={isPassword ? (show ? "text" : "password") : type}
                autoComplete={autoComplete}
                translate="no"
                className={`field-input ${mono ? "font-mono" : ""} ${isPassword ? "pr-11" : ""}`}
                {...field}
                value={typeof field.value === "boolean" ? "" : (field.value ?? "")}
              />
            </FormControl>
            {isPassword && (
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute right-1 top-1/2 flex-center size-9 -translate-y-1/2 rounded-sm text-ink-faint hover:text-ink"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
          <FormMessage className="field-error" />
        </FormItem>
      )}
    />
  );
};

export default CustomInput;
