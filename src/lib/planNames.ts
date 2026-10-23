// Subscriptions billed through an app store arrive in a statement as "Google
// Play" or "Apple" and nothing more: the store never passes the app's name on.
// What it does pass on is the price, and each plan has a fixed one, so the
// price is a fair guess at the plan. A guess only: the person confirms it,
// and prices change (keep this list current).

/** Whether a payee is a store that bills for other apps (its name says nothing about the subscription). */
export const isStore = (payeeKey: string) => /google|play ?store|apple|app ?store|itunes/i.test(payeeKey);

const PLAY: [number, string][] = [
  [89, "YouTube Premium (student)"],
  [149, "YouTube Premium"],
  [219, "YouTube Premium (duo)"],
  [299, "YouTube Premium (family)"],
  [130, "Google One 100 GB"],
  [210, "Google One 200 GB"],
  [650, "Google One 2 TB"],
  [1950, "Google One AI Premium"],
];
const APPLE: [number, string][] = [
  [75, "iCloud+ 50 GB"],
  [219, "iCloud+ 200 GB"],
  [749, "iCloud+ 2 TB"],
  [59, "Apple Music (student)"],
  [99, "Apple Music"],
  [99, "Apple TV+"],
  [149, "Apple Music (family)"],
  [195, "Apple One"],
  [365, "Apple One (family)"],
];

/** Names people can pick from when a payment needs one; a typed name is just as good. */
export const PLAN_NAMES = [
  "YouTube Premium",
  "Google One",
  "Netflix",
  "Amazon Prime",
  "Spotify",
  "Apple Music",
  "iCloud+",
  "JioHotstar",
  "Zee5",
  "SonyLIV",
  "Crunchyroll",
  "ChatGPT",
  "Microsoft 365",
  "Adobe",
  "Canva",
  "Audible",
  "Kindle Unlimited",
  "Gym",
  "Cloud storage",
];

/** The plans a store charges this much for (rupees only, within 3%), likeliest first. */
export function planGuesses(payeeKey: string, amount: number, currency = "INR"): string[] {
  if (currency !== "INR" || !isStore(payeeKey)) return [];
  const table = /apple|app ?store|itunes/i.test(payeeKey) ? APPLE : PLAY;
  const paid = Math.abs(amount);
  return [...new Set(table.filter(([price]) => Math.abs(paid - price) <= price * 0.03).map(([, name]) => name))];
}
