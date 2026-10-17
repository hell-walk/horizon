import type { Metadata } from "next";

import { getT } from "@/lib/i18n/server";

import UnsubscribeButton from "../components/unsubscribeButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("remind.unsubTitle"), robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

// Where the "Stop these emails" link in a reminder lands. A button, not an
// automatic change: email scanners open links, and must not turn anyone's
// reminders off. The link's signature is checked when the button is pressed.
export default async function UnsubscribePage({ searchParams }: Props) {
  const t = await getT();
  const { u, t: signature } = await searchParams;
  return (
    <>
      <h1>{t("remind.unsubTitle")}</h1>
      <p>{t("remind.unsubBody")}</p>
      <UnsubscribeButton u={typeof u === "string" ? u : ""} signature={typeof signature === "string" ? signature : ""} />
    </>
  );
}
