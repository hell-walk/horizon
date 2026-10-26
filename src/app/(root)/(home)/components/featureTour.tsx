import { CAPABILITY_ROUTES as ROUTES } from "@/components/brand/landingStory";
import { getT } from "@/lib/i18n/server";

import FeatureSlides, { type FeatureSlide } from "./featureSlides";

/** What Horizon is and can do, as a slideshow under the greeting. */
const FeatureTour = async () => {
  const t = await getT();
  // First the landing page's top, in two: the name and its line; then what Horizon does and the two things to do next.
  const welcome: FeatureSlide[] = [
    { n: "welcome", wordmark: "Horizon", title: t("landing.tagline"), body: "" },
    {
      n: "start",
      chip: "Horizon",
      body: t("landing.heroBody"),
      actions: [
        { href: "/connect-bank", label: t("nav.connect"), kind: "connect" },
        { href: "/upload-statement", label: t("home.actionUpload"), kind: "upload" },
      ],
    },
  ];
  const slides: FeatureSlide[] = [
    ...welcome,
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
