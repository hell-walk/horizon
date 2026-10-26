import z from "zod";

import { isCountry, needsStateAndPostal, needsUsIdentity } from "../content/countries";
import type { Translate } from "../i18n/translate";
import { isIncomeKind } from "../finance/income";

// The sign-in, sign-up and welcome forms' checks. Kept apart from utils so
// that zod is loaded only with these forms, not by every page.
export const authFormSchema = (type: string, t: Translate) => {
  // (How the person earns is one of lib/finance/income's four kinds.)
  const signUp = type === "sign-up";
  // "welcome": signed in with Google, finishing the profile. Same questions as
  // sign-up, minus the email and password Google already settled.
  const welcome = type === "welcome";
  const profile = signUp || welcome;
  const optional = () => z.string().optional();
  const tooLong = (max: number) => t("auth.errorTooLong", { max });

  return z
    .object({
      email: welcome ? optional() : z.string().email(t("auth.errorEmail")),
      password: welcome ? optional() : z.string().min(8, t("auth.passwordTooShort")),
      confirmPassword: signUp ? z.string().min(1, t("auth.errorConfirmPassword")) : optional(),
      terms: profile ? z.boolean().refine((v) => v, t("auth.errorTerms")) : z.boolean().optional(),
      firstName: profile ? z.string().min(2, t("auth.errorFirstName")) : optional(),
      lastName: profile ? z.string().min(2, t("auth.errorLastName")) : optional(),
      country: profile ? z.string().refine(isCountry, t("auth.errorCountry")) : optional(),
      address1: profile ? z.string().min(3, t("auth.errorStreet")).max(50, tooLong(50)) : optional(),
      city: profile ? z.string().min(2, t("auth.errorCity")).max(20, tooLong(20)) : optional(),
      incomeKind: profile ? z.string().refine(isIncomeKind, t("auth.errorIncomeKind")) : optional(),
      // Region, postal code, date of birth and SSN depend on the country: checked below.
      state: optional(),
      postalCode: optional(),
      dob: optional(),
      ssn: optional(),
    })
    .refine((data) => !signUp || data.password === data.confirmPassword, {
      message: t("auth.errorPasswordsDiffer"),
      path: ["confirmPassword"],
    })
    .superRefine((data, ctx) => {
      if (!profile) return;
      const country = data.country ?? "";
      const state = (data.state ?? "").trim();
      const postal = (data.postalCode ?? "").trim();
      if (state.length > 30) ctx.addIssue({ code: "custom", path: ["state"], message: tooLong(30) });
      if (needsStateAndPostal(country) && state.length < 2) ctx.addIssue({ code: "custom", path: ["state"], message: t("auth.errorState") });
      if ((needsStateAndPostal(country) || postal) && !/^[A-Za-z0-9 -]{3,10}$/.test(postal)) {
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: t("auth.errorPostalCode") });
      }
      if (welcome && needsUsIdentity(country)) {
        const dob = data.dob ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) ctx.addIssue({ code: "custom", path: ["dob"], message: t("auth.errorDobFormat") });
        else if (Number.isNaN(Date.parse(dob)) || new Date(dob) >= new Date()) ctx.addIssue({ code: "custom", path: ["dob"], message: t("auth.errorDobPast") });
        if ((data.ssn ?? "").trim().length < 4) ctx.addIssue({ code: "custom", path: ["ssn"], message: t("auth.errorTaxId") });
      }
    });
};
