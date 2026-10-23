import { getT } from "@/lib/i18n/server";

import FeatureSlides, { type FeatureSlide } from "./featureSlides";

/** The pages each of the six capabilities lives on. */
const ROUTES = ["/my-banks", "/transaction-history", "/bills", "/charges", "/loans", "/transaction-history#payees"];

/** What Horizon is and can do, as a slideshow under the greeting. */
const FeatureTour = async () => {
  const t = await getT();
  // First the landing page's top: the eyebrow, the name, the line, the two things to do next.
  const welcome: FeatureSlide = {
    n: "welcome",
    chip: t("landing.heroEyebrow"),
    wordmark: "Horizon",
    title: t("landing.tagline"),
    body: t("landing.heroBody"),
    actions: [
      { href: "/connect-bank", label: t("nav.connect"), kind: "connect" },
      { href: "/upload-statement", label: t("home.actionUpload"), kind: "upload" },
    ],
  };
  const slides: FeatureSlide[] = [
    welcome,
    ...ROUTES.map((href, i) => {
      const n = String(i + 1).padStart(2, "0");
      return { n, chip: n, title: t(`landing.cap${i + 1}Title`), body: t(`landing.cap${i + 1}Body`), href };
    }),
  ];
  return (
    <FeatureSlides slides={slides} labels={{ heading: t("home.tourHeading"), open: t("home.tourOpen"), prev: t("home.tourPrev"), next: t("home.tourNext") }} />
  );
};

export default FeatureTour;
