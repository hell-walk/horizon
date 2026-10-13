import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getT } from "@/lib/i18n/server";

import EmailLinkButton from "../../components/emailLinkButton";

// Where the links in Horizon's emails land: confirming a sign-up, or starting a
// password reset. The page itself verifies nothing; a button does, on a click.
// Mail scanners open every link in an email, so a link that counted as used on
// opening would already be spent when the person clicks it. The link carries a
// token hash, so it works on any device, not only the browser that asked.
//
// Supabase -> Authentication -> Email Templates must point here:
//   Confirm signup:   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   Reset password:   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.linkTitle"), robots: { index: false, follow: false } };
}

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type } = await searchParams;
  const kind = type === "recovery" ? "recovery" : type === "email" || type === "signup" ? "email" : null;
  if (!kind || typeof tokenHash !== "string" || !tokenHash) redirect("/sign-in?failed=1");
  return (
    <section className="flex w-full justify-center">
      <EmailLinkButton tokenHash={tokenHash} type={type!} kind={kind} />
    </section>
  );
}
