import type { Translate } from "./translate";

// Names that data code produces in English: spending buckets (lib/spending),
// generic payee groups (lib/payees), bank and statement categories, payment
// channels. They stay English as data (colours, sorting and grouping depend on
// them) and are translated only where shown. One key per name, in common.json:
// common.label_<name in snake case>. A name with no key (a merchant, a person)
// is shown as it is.

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const labelKey = (name: string) => `common.label_${slug(name)}`;

export function dataLabel(t: Translate, name: string | undefined | null): string {
  if (!name) return "";
  const key = labelKey(name);
  const text = t(key);
  return text === key ? name : text;
}
