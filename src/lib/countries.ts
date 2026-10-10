// Countries for sign-up. Names come from the browser or server itself
// (Intl.DisplayNames), so they appear in the screen's language without a
// translation list. What a country is asked for:
//   US     - state, ZIP, date of birth and SSN: the US payment partner (Dwolla)
//            needs them to open a payment account, and keeps them, not Horizon.
//   IN     - state and PIN code.
//   others - street and city; region and postal code if they have one.

// ISO 3166-1 alpha-2 codes in use.
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU " +
  "CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL " +
  "IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV " +
  "MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR " +
  "SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const KNOWN = new Set(COUNTRY_CODES);
export const isCountry = (value: unknown): value is string => typeof value === "string" && KNOWN.has(value);

/** Shown first: where most people using Horizon live. */
const FIRST = ["IN", "US"];

/** Countries with their names in the given language (a BCP 47 tag like "en-IN" or "hi-IN"), India and the US first. */
export function countryList(localeTag: string): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([localeTag, "en"], { type: "region" });
  } catch {
    names = null;
  }
  const named = COUNTRY_CODES.map((code) => ({ code, name: names?.of(code) ?? code }));
  const first = FIRST.map((code) => named.find((c) => c.code === code)!);
  const rest = named.filter((c) => !FIRST.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, localeTag));
  return [...first, ...rest];
}

/** Whether the state (or province) and postal code must be given. */
export const needsStateAndPostal = (country: string) => country === "US" || country === "IN";

/** Whether date of birth and SSN are asked (only for the US payment partner). */
export const needsUsIdentity = (country: string) => country === "US";
