import { cookies } from "next/headers";

import { getT } from "@/lib/i18n/server";

import FeatureSlides, { TOUR_HIDDEN_COOKIE, type FeatureSlide } from "./featureSlides";

/** The pages each of the six capabilities lives on. */
const ROUTES = ["/my-banks", "/transaction-history", "/bills", "/charges", "/loans", "/transaction-history#payees"];

/** What Horizon is and can do, as a slideshow under the greeting; nothing for a month after it is hidden. */
const FeatureTour = async () => {
  if ((await cookies()).get(TOUR_HIDDEN_COOKIE)?.value === "1") return null;
  const t = await getT();
  // First the landing page's top, small: the line, and the two things to do next.
  const welcome: FeatureSlide = {
    n: "Horizon",
    title: t("landing.tagline"),
    body: t("landing.heroBody"),
    actions: [
      { href: "/connect-bank", label: t("nav.connect"), kind: "connect" },
      { href: "/upload-statement", label: t("home.actionUpload"), kind: "upload" },
    ],
  };
  const slides: FeatureSlide[] = [
    welcome,
    ...ROUTES.map((href, i) => ({ n: String(i + 1).padStart(2, "0"), title: t(`landing.cap${i + 1}Title`), body: t(`landing.cap${i + 1}Body`), href })),
  ];
  return (
    <FeatureSlides
      slides={slides}
      labels={{ heading: t("home.tourHeading"), open: t("home.tourOpen"), hide: t("home.tourHide"), prev: t("home.tourPrev"), next: t("home.tourNext") }}
    />
  );
};

export default FeatureTour;
