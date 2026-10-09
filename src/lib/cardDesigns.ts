// Card skins. The look (two-tone diagonal split, chip, contactless mark) comes
// from the Stitch card showcase. Bank skins use each bank's colours with its
// name as plain text, and are only applied to that bank's own accounts; the
// themes are unbranded so no card ever claims a network it isn't on.

export type CardDesign = {
  id: string;
  label: string;
  from: string; // left of the split
  to: string; // right of the split
  kind: "classic" | "bank" | "theme";
  match?: RegExp; // bank skins: which accounts they belong to
};

export const CLASSIC: CardDesign = { id: "classic", label: "Classic", from: "#000000", to: "#151515", kind: "classic" };

export const BANK_DESIGNS: CardDesign[] = [
  { id: "sbi", label: "SBI", from: "#123a86", to: "#2c6fd1", kind: "bank", match: /state bank|\bsbi\b/i },
  { id: "hdfc", label: "HDFC Bank", from: "#0f2a57", to: "#1e4a97", kind: "bank", match: /hdfc/i },
  { id: "icici", label: "ICICI Bank", from: "#4f1424", to: "#9b2c45", kind: "bank", match: /icici/i },
  { id: "pnb", label: "PNB", from: "#7c1d17", to: "#c4462d", kind: "bank", match: /punjab national|\bpnb\b/i },
  { id: "axis", label: "Axis Bank", from: "#4f1238", to: "#97144d", kind: "bank", match: /\baxis\b/i },
  { id: "kotak", label: "Kotak", from: "#5a1020", to: "#b3213a", kind: "bank", match: /kotak/i },
  { id: "bob", label: "Bank of Baroda", from: "#9c3a12", to: "#ec6a2b", kind: "bank", match: /bank of baroda|\bbob\b/i },
  { id: "idfc", label: "IDFC First", from: "#5e1218", to: "#9c1d26", kind: "bank", match: /idfc/i },
  { id: "yes", label: "Yes Bank", from: "#0b3a73", to: "#1565c0", kind: "bank", match: /yes bank/i },
  { id: "canara", label: "Canara Bank", from: "#0a4a84", to: "#1d86c8", kind: "bank", match: /canara/i },
  { id: "union", label: "Union Bank", from: "#8f1018", to: "#d4212a", kind: "bank", match: /union bank/i },
  { id: "chase", label: "Chase", from: "#0b2f6b", to: "#1172c9", kind: "bank", match: /chase/i },
];

export const THEME_DESIGNS: CardDesign[] = [
  { id: "midnight", label: "Midnight", from: "#0f172a", to: "#1e3a8a", kind: "theme" },
  { id: "ocean", label: "Ocean", from: "#0c3b5e", to: "#1b74b0", kind: "theme" },
  { id: "emerald", label: "Emerald", from: "#064e3b", to: "#0f8a6a", kind: "theme" },
  { id: "teal", label: "Teal", from: "#134e4a", to: "#0d9488", kind: "theme" },
  { id: "burgundy", label: "Burgundy", from: "#4c0519", to: "#9f1239", kind: "theme" },
  { id: "plum", label: "Plum", from: "#3b0764", to: "#7e22ce", kind: "theme" },
  { id: "sunset", label: "Sunset", from: "#9a3412", to: "#f97316", kind: "theme" },
  { id: "graphite", label: "Graphite", from: "#1f2937", to: "#4b5563", kind: "theme" },
];

const ALL = [CLASSIC, ...BANK_DESIGNS, ...THEME_DESIGNS];

/** The bank skin for an account, from its name, if Horizon has one. */
export const bankDesignFor = (account: Pick<Account, "name" | "officialName">) =>
  BANK_DESIGNS.find((d) => d.match!.test(`${account.name ?? ""} ${account.officialName ?? ""}`));

/**
 * The design to draw: the saved choice, or "auto" (the account's bank skin
 * when known, else Classic). A bank skin is only honoured on that bank's
 * accounts, so an SBI look can never land on an HDFC card.
 */
export function resolveCardDesign(account: Pick<Account, "name" | "officialName" | "cardDesign">): CardDesign {
  const own = bankDesignFor(account);
  const chosen = ALL.find((d) => d.id === account.cardDesign);
  if (!chosen) return own ?? CLASSIC; // "auto" or unset
  if (chosen.kind === "bank") return chosen.id === own?.id ? chosen : own ?? CLASSIC;
  return chosen;
}

/** Choices offered for an account: Auto, its own bank skin (if any), Classic and the themes. */
export function designChoices(account: Pick<Account, "name" | "officialName">) {
  const own = bankDesignFor(account);
  return [
    { id: "auto", label: own ? `Auto (${own.label})` : "Auto", design: own ?? CLASSIC },
    ...(own ? [{ id: own.id, label: own.label, design: own }] : []),
    { id: CLASSIC.id, label: CLASSIC.label, design: CLASSIC },
    ...THEME_DESIGNS.map((d) => ({ id: d.id, label: d.label, design: d })),
  ];
}

export const isKnownDesign = (id: string) => id === "auto" || ALL.some((d) => d.id === id);

/** The two-tone diagonal split: a hard colour stop rather than a soft blend. */
export const cardBackground = (d: CardDesign) =>
  d.kind === "classic" ? d.from : `linear-gradient(125deg, ${d.from} 0%, ${d.from} 52%, ${d.to} 52%, ${d.to} 100%)`;
