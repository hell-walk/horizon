export type Messages = Record<string, string>;

/** The areas' tables as one: { "area.key": text }. */
export const flatten = (areas: Record<string, Record<string, string>>): Messages =>
  Object.fromEntries(Object.entries(areas).flatMap(([area, entries]) => Object.entries(entries).map(([key, text]) => [`${area}.${key}`, text])));
