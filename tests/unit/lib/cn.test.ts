import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// cn() decides which class wins when two conflict. Horizon's own text sizes
// (text-10 ... text-40) must survive next to a text colour.
describe("cn", () => {
  it("keeps Horizon's text sizes next to text colours", () => {
    expect(cn("text-14 font-semibold text-ink")).toBe("text-14 font-semibold text-ink");
    expect(cn("text-13 text-ink-muted", "text-ink")).toBe("text-13 text-ink");
  });

  it("still lets a later size or colour replace an earlier one", () => {
    expect(cn("text-13 text-ink-muted", "text-16")).toBe("text-ink-muted text-16");
    expect(cn("text-ink", "text-danger")).toBe("text-danger");
  });

  it("understands Tailwind 4 names", () => {
    expect(cn("shadow-xs", "shadow-lift")).toBe("shadow-lift");
    expect(cn("outline-hidden", "outline-2")).toBe("outline-hidden outline-2");
  });
});
