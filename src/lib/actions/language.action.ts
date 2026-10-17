"use server";

import { isLocale } from "../i18n/config";
import { loadSession } from "../server/auth";
import { allow, MINUTE } from "../server/rateLimit";
import { createSupabaseServerClient } from "../server/supabase";

// The person's own regional language, kept on their login (user_metadata) so
// it follows them to a new device. A public endpoint: it changes only the
// signed-in person's own setting, and only to one of Horizon's languages.

export async function saveHomeLanguage(input: { locale: unknown }): Promise<{ ok: boolean }> {
  if (!isLocale(input?.locale)) return { ok: false };
  const session = await loadSession();
  if (!session) return { ok: false };
  if (!(await allow(`language:${session.id}`, 10, 10 * MINUTE))) return { ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ data: { home_language: input.locale } });
  return { ok: !error };
}
