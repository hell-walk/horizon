"use server";

import { revalidatePath } from "next/cache";

import { isIncomeKind } from "../income";
import { getT } from "../i18n/server";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { dayOfMonth, loadIncome, salaryOptions, sentMoneyIn, type IncomingPayer, type SalaryOption } from "../server/income";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { allow, MINUTE } from "../server/rateLimit";

const MAX_DECLARED = 100_000_000;
const MAX_NAME = 80;
const MAX_EXCLUDED = 20;

/**
 * What the chooser shows someone about to say they are salaried: the credits
 * that look like a salary (best first, each to confirm or turn down), and
 * everyone who sent money in, to pick the salary from when none of those is it.
 */
export async function salaryCandidate(): Promise<{ ok: true; candidates: SalaryOption[]; payers: IncomingPayer[] } | { ok: false }> {
  const user = await getLoggedInUser();
  if (!user) return { ok: false };
  const owner = ownerIdOf(user);
  if (!(await allow(`income-look:${owner}`, 30, 10 * MINUTE))) return { ok: false };
  try {
    return { ok: true, ...(await salaryOptions(owner, [user.firstName, user.lastName].filter(Boolean) as string[])) };
  } catch (error) {
    logError("income: could not look for the employer", error);
    return { ok: false };
  }
}

const cleanPayee = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_NAME) : "");

/**
 * Remember how the person earns, and for a freelancer the monthly figure they
 * gave. "Salaried" needs the salary credit the person confirmed or picked
 * (`salaryPayee`), and the server checks it really sent them money in: so a
 * salary is only ever saved once Horizon has seen it and the person has said
 * yes to it. `rejected`: the credits they said are not their salary, kept so
 * nothing asks about them again.
 */
export async function setIncome({
  kind,
  declared,
  side,
  payDay,
  salaryPayee,
  rejected,
}: {
  kind: string;
  declared?: number | null;
  side?: number | null;
  payDay?: number | null;
  salaryPayee?: string | null;
  rejected?: string[] | null;
}) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (!isIncomeKind(kind)) return { ok: false as const, error: t("auth.errorIncomeKind") };
  const figure =
    kind === "freelancer" && typeof declared === "number" && Number.isFinite(declared) && declared > 0 && declared <= MAX_DECLARED
      ? Math.round(declared)
      : undefined;
  // A side income only makes sense on top of a salary.
  const sideFigure =
    kind === "salaried" && typeof side === "number" && Number.isFinite(side) && side > 0 && side <= MAX_DECLARED ? Math.round(side) : undefined;
  const owner = ownerIdOf(user);
  if (!(await allow(`income:${owner}`, 20, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    const current = await loadIncome(owner);
    const payee = cleanPayee(salaryPayee);
    // Salaried: the credit the person confirmed or picked must be in their own statements.
    const employer = kind === "salaried" && payee ? await sentMoneyIn(owner, payee) : undefined;
    if (kind === "salaried" && !employer) return { ok: false as const, error: t("home.incomeEmployerNone") };
    // The pay day: the day they gave, else the day the employer's last credit arrived.
    const given = typeof payDay === "number" && Number.isInteger(payDay) && payDay >= 1 && payDay <= 31 ? payDay : undefined;
    const onDay = kind === "salaried" ? (given ?? dayOfMonth(employer?.last)) : undefined;
    const turnedDown = (Array.isArray(rejected) ? rejected : []).map(cleanPayee).filter((p) => p && p.toLowerCase() !== payee.toLowerCase());
    const excluded = [...new Set([...(current?.excluded ?? []), ...turnedDown])].filter((p) => p.toLowerCase() !== payee.toLowerCase()).slice(-MAX_EXCLUDED);
    // A confirmed salary is kept across a change of kind; so are the "not my salary" answers.
    const salary = kind === "salaried" ? employer!.payee : current?.salaryPayee;
    await updatePrefs(owner, {
      income: {
        kind,
        ...(salary ? { salaryPayee: salary } : {}),
        ...(excluded.length ? { excluded } : {}),
        ...(figure ? { declared: figure } : {}),
        ...(sideFigure ? { side: sideFigure } : {}),
        ...(onDay ? { payDay: onDay } : {}),
      },
    });
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    logError("income: could not save how the person earns", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
