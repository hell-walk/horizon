// The guided tours: a few steps each, every step pointing at one thing on one
// page, in the person's language (messages/*/tour.json). "home" is the walk a
// new person gets once; the others are the Demo behind each box on the About
// page. Pure data: the client engine (components/tour) does the pointing.

export type TourStep = {
  /** The page the step lives on ("/" exact, anything else by prefix). */
  page: string;
  /** CSS selectors to try, first visible match wins; none, or none found: the card sits in the middle on its own. */
  target?: string[];
  /** tour.<key>Title and tour.<key>Body. */
  key: string;
  /** The opening card, with the scroll-and-swipe hint on phones. */
  intro?: boolean;
};

export const TOURS: Record<string, TourStep[]> = {
  home: [
    { page: "/", key: "welcome", intro: true },
    { page: "/", target: ['section[aria-roledescription="carousel"]'], key: "homeTour" },
    { page: "/", target: ['[data-tour="balance"]'], key: "homeBalance" },
    { page: "/", target: ['section[aria-labelledby="income-title"]'], key: "homeIncome" },
    { page: "/", target: ['section[aria-labelledby="report-numbers"]'], key: "homeMonth" },
    { page: "/", target: ['[data-tour="cards"]'], key: "homeCards" },
    { page: "/", target: ['[data-tour="actions"]'], key: "homeActions" },
    { page: "/", target: ['[data-tour="banks"]'], key: "homeBanks" },
    { page: "/", target: ['[data-tour="forecast"]'], key: "homeForecast" },
    { page: "/", key: "homeDone" },
  ],
  banks: [
    { page: "/my-banks", target: ['section[aria-labelledby="coverage-title"]', ".page .panel"], key: "banksCoverage" },
    { page: "/connect-bank", target: [".page .grid"], key: "banksConnect" },
  ],
  spending: [
    { page: "/transaction-history", target: ['section[aria-labelledby="months-title"]'], key: "spendingMonths" },
    { page: "/transaction-history", target: ["#payees"], key: "spendingPayees" },
    { page: "/transaction-history", target: [".page > section.panel:last-of-type", ".page .panel:last-of-type"], key: "spendingList" },
  ],
  "bills-and-goals": [
    { page: "/bills", target: [".page .grid"], key: "billsTiles" },
    { page: "/bills", target: ['[data-tour="forecast"]'], key: "billsForecast" },
    { page: "/goals", target: [".page .panel"], key: "goalsBoard" },
  ],
  charges: [
    { page: "/charges", target: [".page .grid"], key: "chargesTiles" },
    { page: "/charges", target: [".page .grid ~ .panel", ".page .grid ~ section"], key: "chargesList" },
  ],
  loans: [
    { page: "/loans", target: [".page .grid"], key: "loansTiles" },
    { page: "/loans", target: ['section[aria-labelledby="loans-order"]'], key: "loansOrder" },
    { page: "/loans", target: ['section[aria-labelledby="subs-title"]'], key: "loansSubs" },
  ],
  "spending-detail": [{ page: "/transaction-history", target: ["#payees"], key: "detailPayees" }],
  forecast: [
    { page: "/calendar", target: [".page .grid"], key: "forecastTiles" },
    { page: "/calendar", target: ['section[aria-labelledby="month-grid-title"]'], key: "forecastGrid" },
    { page: "/bills", target: ['[data-tour="forecast"]'], key: "forecastPanel" },
  ],
  report: [
    { page: "/report", target: [".page .grid"], key: "reportTiles" },
    { page: "/report", target: [".page .grid ~ *"], key: "reportParts" },
  ],
  checks: [{ page: "/checks", target: ['section[aria-labelledby="checks-title"]', ".page .panel"], key: "checksList" }],
};

export const isTourId = (value: unknown): value is keyof typeof TOURS => typeof value === "string" && value in TOURS;

/** The words the engine needs, all tours and the buttons: the layout translates them once and hands them over. */
export const TOUR_UI_KEYS = ["next", "back", "skip", "done", "stepOf", "takeTour", "demo", "hint"] as const;
export const TOUR_WORD_KEYS: string[] = [...TOUR_UI_KEYS, ...Object.values(TOURS).flatMap((steps) => steps.flatMap((s) => [`${s.key}Title`, `${s.key}Body`]))];

/** Whether a step belongs on this path. */
export const stepIsOn = (step: TourStep, pathname: string) =>
  step.page === "/" ? pathname === "/" : pathname === step.page || pathname.startsWith(`${step.page}/`);

export const TOUR_STORAGE = "horizon-tour";
export const TOUR_EVENT = "horizon-tour";
export const TOUR_DONE_COOKIE = "horizon-tour-done";
