import "server-only";

// Error logging that cannot leak secrets. Provider errors (Plaid's HTTP client
// in particular) carry the whole request: headers with API secrets, bodies
// with access tokens. So only a short summary is ever logged, and even that
// is scrubbed of anything that looks like a token, account number or email.

import { redact } from "../scrub";

export { redact };

type ErrorLike = {
  name?: string;
  message?: string;
  code?: string | number;
  type?: string;
  status?: number;
  response?: { status?: number; data?: { error_code?: string; error_type?: string } };
  body?: { code?: string };
};

/** A one-line, secret-free description of an error. */
export function describeError(error: unknown): string {
  if (error === null || error === undefined) return "";
  if (typeof error !== "object") return redact(String(error)).slice(0, 300);
  const e = error as ErrorLike;
  const parts = [
    e.name,
    e.message,
    e.code !== undefined ? `code=${e.code}` : undefined,
    e.type ? `type=${e.type}` : undefined, // Appwrite
    e.response?.status ? `status=${e.response.status}` : e.status ? `status=${e.status}` : undefined,
    e.response?.data?.error_code ? `plaid=${e.response.data.error_type}/${e.response.data.error_code}` : undefined,
    e.body?.code ? `dwolla=${e.body.code}` : undefined,
  ];
  return redact(parts.filter(Boolean).join(" | ")).slice(0, 500);
}

export function logError(context: string, error?: unknown) {
  console.error(`[${context}]`, describeError(error));
}

export function logWarn(context: string, error?: unknown) {
  console.warn(`[${context}]`, describeError(error));
}
