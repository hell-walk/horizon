import { describe, expect, it } from "vitest";

import en from "@/lib/i18n/messages/en/tour.json";
import { ABOUT_FEATURES } from "@/lib/content/aboutFeatures";
import { stepIsOn, TOUR_WORD_KEYS, TOURS } from "@/lib/content/tour";

describe("the guided tours", () => {
  it("have words for every step and button", () => {
    const words = en as Record<string, string>;
    for (const key of TOUR_WORD_KEYS) expect(words[key], key).toBeTruthy();
  });
  it("every About box has a tour, and every step names a page", () => {
    for (const f of ABOUT_FEATURES) expect(TOURS[f.slug], f.slug).toBeDefined();
    for (const steps of Object.values(TOURS)) for (const s of steps) expect(s.page.startsWith("/")).toBe(true);
  });
  it("knows which page a step is on", () => {
    expect(stepIsOn({ page: "/", key: "x" }, "/")).toBe(true);
    expect(stepIsOn({ page: "/", key: "x" }, "/bills")).toBe(false);
    expect(stepIsOn({ page: "/bills", key: "x" }, "/bills")).toBe(true);
    expect(stepIsOn({ page: "/bills", key: "x" }, "/bills-and-goals")).toBe(false);
  });
});
