"use server";

import { ID } from "node-appwrite";

import { getLocale, getT } from "../i18n/server";
import { createAdminClient } from "../server/appwrite";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";

// The feedback form. A public endpoint like every action: the sender comes
// from the session, never from the form. Free on every plan, even after the
// trial: hearing what is missing matters most from people who stopped paying.

export type FeedbackResult = { ok: true } | { ok: false; error: string };

const KINDS = new Set(["missing", "problem", "idea", "other"]);
const FEEDBACK_MIN = 10;
const FEEDBACK_MAX = 2000;

/** Saves one message for the Horizon team. */
export async function sendFeedback(input: { kind: string; message: string; page?: string; mayReply?: boolean }): Promise<FeedbackResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("feedback.errSignIn") };

  const kind = typeof input?.kind === "string" && KINDS.has(input.kind) ? input.kind : null;
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!kind) return { ok: false, error: t("feedback.errKind") };
  if (message.length < FEEDBACK_MIN || message.length > FEEDBACK_MAX) return { ok: false, error: t("feedback.errLength", { min: FEEDBACK_MIN, max: FEEDBACK_MAX }) };
  // Only a path on this site, kept short: where they were when they wrote.
  const page = typeof input?.page === "string" && /^\/[\w\-/?=&.%]*$/.test(input.page) ? input.page.slice(0, 200) : "";
  if (!(await allow(`feedback:${ownerIdOf(user)}`, 5, 60 * MINUTE))) return { ok: false, error: t("feedback.errTooMany") };

  try {
    const { database } = await createAdminClient();
    await database.createDocument(process.env.APPWRITE_DATABASE_ID!, process.env.APPWRITE_FEEDBACK_COLLECTION_ID!, ID.unique(), {
      ownerId: ownerIdOf(user),
      kind,
      message,
      page,
      locale: await getLocale(),
      // Their email only when they ticked "you may reply".
      replyTo: input?.mayReply === true ? user.email : null,
    });
    return { ok: true };
  } catch (error) {
    logError("feedback: could not save", error);
    return { ok: false, error: t("feedback.errFailed") };
  }
}
