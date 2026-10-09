import { type ClassValue, clsx } from "clsx";
import qs from "query-string";
import { twMerge } from "tailwind-merge";
import z from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// FORMAT DATE TIME
export const formatDateTime = (dateString: Date) => {
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    weekday: "short", // abbreviated weekday name (e.g., 'Mon')
    month: "short", // abbreviated month name (e.g., 'Oct')
    day: "numeric", // numeric day of the month (e.g., '25')
    hour: "numeric", // numeric hour (e.g., '8')
    minute: "numeric", // numeric minute (e.g., '30')
    hour12: true, // use 12-hour clock (true) or 24-hour clock (false)
  };

  const dateDayOptions: Intl.DateTimeFormatOptions = {
    weekday: "short", // abbreviated weekday name (e.g., 'Mon')
    year: "numeric", // numeric year (e.g., '2023')
    month: "2-digit", // abbreviated month name (e.g., 'Oct')
    day: "2-digit", // numeric day of the month (e.g., '25')
  };

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short", // abbreviated month name (e.g., 'Oct')
    year: "numeric", // numeric year (e.g., '2023')
    day: "numeric", // numeric day of the month (e.g., '25')
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric", // numeric hour (e.g., '8')
    minute: "numeric", // numeric minute (e.g., '30')
    hour12: true, // use 12-hour clock (true) or 24-hour clock (false)
  };

  const formattedDateTime: string = new Date(dateString).toLocaleString(
    "en-US",
    dateTimeOptions
  );

  const formattedDateDay: string = new Date(dateString).toLocaleString(
    "en-US",
    dateDayOptions
  );

  const formattedDate: string = new Date(dateString).toLocaleString(
    "en-US",
    dateOptions
  );

  const formattedTime: string = new Date(dateString).toLocaleString(
    "en-US",
    timeOptions
  );

  return {
    dateTime: formattedDateTime,
    dateDay: formattedDateDay,
    dateOnly: formattedDate,
    timeOnly: formattedTime,
  };
};

// Locale per currency so grouping and symbol placement follow the money, not the viewer.
const CURRENCY_LOCALES: Record<string, string> = { INR: "en-IN", USD: "en-US", GBP: "en-GB", EUR: "de-DE" };

export function formatAmount(amount: number | string, currency: string = "USD"): string {
  const code = currency || "USD";
  const formatter = new Intl.NumberFormat(CURRENCY_LOCALES[code] ?? "en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
  });

  return formatter.format(typeof amount === "string" ? parseFloat(amount) || 0 : amount);
}

export const parseStringify = (value: any) => JSON.parse(JSON.stringify(value));

export const removeSpecialCharacters = (value: string) => {
  return value.replace(/[^\w\s]/gi, "");
};

interface UrlQueryParams {
  params: string;
  key: string;
  value: string;
}

export function formUrlQuery({ params, key, value }: UrlQueryParams) {
  const currentUrl = qs.parse(params);

  currentUrl[key] = value;

  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: currentUrl,
    },
    { skipNull: true }
  );
}

// Spend per category for one account (debits only), largest first.
export type CategorySpend = { name: string; amount: number; count: number; share: number };

export function sumTransactionCategories(transactions: Transaction[] = [], limit = 5): CategorySpend[] {
  const totals: Record<string, { amount: number; count: number }> = {};
  let total = 0;

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (!isDebit || amount === 0) continue;

    const name = t.category || "Other";
    totals[name] = { amount: (totals[name]?.amount ?? 0) + amount, count: (totals[name]?.count ?? 0) + 1 };
    total += amount;
  }

  const sorted = Object.entries(totals)
    .map(([name, { amount, count }]) => ({ name, amount, count, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);

  if (sorted.length <= limit) return sorted;

  // Fold the tail into one "Other" entry so the chart stays readable.
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  const other = rest.reduce(
    (acc, c) => ({ name: "Other", amount: acc.amount + c.amount, count: acc.count + c.count, share: acc.share + c.share }),
    { name: "Other", amount: 0, count: 0, share: 0 }
  );
  return [...head, other];
}

// Inflow, outflow and net for a list of transactions in one currency.
export function summarizeTransactions(transactions: Transaction[] = []) {
  let inflow = 0;
  let outflow = 0;
  let credits = 0;
  let debits = 0;
  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    if (t.type === "debit" || Number(t.amount) < 0) {
      outflow += amount;
      debits++;
    } else {
      inflow += amount;
      credits++;
    }
  }
  return { inflow, outflow, net: inflow - outflow, credits, debits };
}

// Short label for a bank account: "Chase ••8912".
export const maskLabel = (mask?: string) => `••${mask || "0000"}`;

export function extractCustomerIdFromUrl(url: string) {
  // Split the URL string by '/'
  const parts = url.split("/");

  // Extract the last part, which represents the customer ID
  const customerId = parts[parts.length - 1];

  return customerId;
}

export function encryptId(id: string) {
  return btoa(id);
}

export function decryptId(id: string) {
  return atob(id);
}

export const getTransactionStatus = (date: Date) => {
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);

  return date > twoDaysAgo ? "Processing" : "Success";
};
export const authFormSchema = (type: string) => {
  const signUp = type === "sign-up";
  const optional = () => z.string().optional();

  return z
    .object({
      email: z.string().email("Enter a valid email address"),
      password: z.string().min(8, "Use at least 8 characters"),
      confirmPassword: signUp ? z.string().min(1, "Repeat your password") : optional(),
      terms: signUp ? z.boolean().refine((v) => v, "Accept the terms to continue") : z.boolean().optional(),
      firstName: signUp ? z.string().min(2, "Enter your first name") : optional(),
      lastName: signUp ? z.string().min(2, "Enter your last name") : optional(),
      address1: signUp ? z.string().min(3, "Enter your street address").max(50) : optional(),
      city: signUp ? z.string().min(2, "Enter your city").max(20) : optional(),
      state: signUp ? z.string().min(2, "Two-letter code").max(15) : optional(),
      postalCode: signUp ? z.string().min(3, "Enter your postal code").max(8) : optional(),
      dob: signUp ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD") : optional(),
      ssn: signUp ? z.string().min(4, "Last 4 digits at least") : optional(),
    })
    .refine((data) => !signUp || data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
};
