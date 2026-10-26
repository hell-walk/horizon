import type { ShotName } from "@/components/brand/shot";

// The ten capabilities on the About page, each with a page of its own: what
// it does (landing.cap*), the closer-look texts where the landing page has
// them (landing.f*), its screenshots, and the page in the app it opens.

export type AboutFeature = { slug: string; n: number; route: string; shots: ShotName[]; looks: number[] };

export const ABOUT_FEATURES: AboutFeature[] = [
  { slug: "banks", n: 1, route: "/my-banks", shots: ["home", "connect"], looks: [1, 2] },
  { slug: "spending", n: 2, route: "/transaction-history", shots: ["history"], looks: [] },
  { slug: "bills-and-goals", n: 3, route: "/bills", shots: ["bills", "goals"], looks: [3, 4] },
  { slug: "charges", n: 4, route: "/charges", shots: ["charges"], looks: [5] },
  { slug: "loans", n: 5, route: "/loans", shots: ["loans"], looks: [6] },
  { slug: "spending-detail", n: 6, route: "/transaction-history#payees", shots: ["spending"], looks: [] },
  { slug: "forecast", n: 7, route: "/calendar", shots: ["calendar", "bills"], looks: [7] },
  { slug: "report", n: 8, route: "/report", shots: ["report"], looks: [8] },
  { slug: "checks", n: 9, route: "/checks", shots: ["checks", "home-phone"], looks: [] },
  { slug: "subscriptions", n: 10, route: "/subscriptions", shots: ["subscriptions"], looks: [9] },
];

export const aboutFeature = (slug: string) => ABOUT_FEATURES.find((f) => f.slug === slug);

/** The landing.* key that describes each screenshot for a screen reader. */
export const SHOT_ALT: Record<ShotName, string> = {
  home: "landing.shotHome",
  history: "landing.shotHistory",
  bills: "landing.shotBills",
  goals: "landing.shotGoals",
  connect: "landing.shotConnect",
  charges: "landing.shotCharges",
  loans: "landing.shotLoans",
  calendar: "landing.shotCalendar",
  report: "landing.shotReport",
  spending: "landing.shotSpending",
  checks: "landing.shotChecks",
  "home-phone": "landing.shotPhone",
  subscriptions: "landing.shotSubscriptions",
};
