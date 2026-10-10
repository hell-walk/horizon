import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Reads the colour tokens straight from globals.css and checks every text
// colour against every surface it can sit on, in both themes. WCAG AA asks for
// 4.5:1 for normal text; a token change that breaks it fails here, not in a
// user's eyes.

const css = readFileSync(join(__dirname, "../../src/app/globals.css"), "utf8");

function tokens(selector: string): Record<string, number[]> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]]));
}

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ["surface", "surface-lowest", "surface-low", "surface-container", "surface-high"];
const TEXT = ["on-surface", "on-surface-variant", "ink-faint"];

describe.each([
  ["light", tokens(":root")],
  ["dark", tokens(".dark")],
])("%s theme", (_theme, t) => {
  it("defines every token the checks need", () => {
    for (const name of [...SURFACES, ...TEXT, "warn-ink", "warn-soft", "danger", "success"]) expect(t[name], name).toBeDefined();
  });

  it.each(TEXT.flatMap((text) => SURFACES.map((surface) => [text, surface])))("%s on %s is at least 4.5:1", (text, surface) => {
    expect(contrast(t[text], t[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it("warning text is readable on its pale background and on the page", () => {
    expect(contrast(t["warn-ink"], t["warn-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["warn-ink"], t.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("money-in and money-out colours are readable on the page", () => {
    expect(contrast(t.danger, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.success, t.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
