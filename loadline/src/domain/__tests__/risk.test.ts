import { describe, expect, it } from "vitest";
import { bandFor, controlsAreIneffective, requiresEscalation, score } from "../risk";
import { HAZARD_LIBRARY } from "../hazard-library";

describe("risk bands", () => {
  /**
   * Every band printed in "PP Risk Assessment PROD2026-002a.docx". If a band
   * threshold is ever retuned, these are the cases it must still reproduce,
   * because documents already issued to clients carry these words.
   */
  it.each([
    [15, "HIGH"],
    [10, "MEDIUM"],
    [12, "MEDIUM"],
    [6, "LOW"],
    [4, "LOW"],
    [16, "HIGH"],
  ])("rates %i as %s, as the source pack does", (rating, band) => {
    expect(bandFor(rating)).toBe(band);
  });

  it("escalates beyond HIGH, which the source pack could not", () => {
    expect(bandFor(20)).toBe("CRITICAL");
    expect(bandFor(25)).toBe("CRITICAL");
  });

  it("multiplies likelihood by severity", () => {
    expect(score(3, 5)).toEqual({
      likelihood: 3,
      severity: 5,
      rating: 15,
      band: "HIGH",
    });
  });
});

describe("control effectiveness", () => {
  it("flags controls that do not reduce the rating", () => {
    expect(controlsAreIneffective(score(3, 4), score(3, 4))).toBe(true);
    expect(controlsAreIneffective(score(3, 4), score(1, 4))).toBe(false);
  });

  it("escalates residual HIGH and CRITICAL only", () => {
    expect(requiresEscalation(score(2, 5))).toBe(false); // 10, MEDIUM
    expect(requiresEscalation(score(4, 4))).toBe(true); // 16, HIGH
    expect(requiresEscalation(score(5, 5))).toBe(true); // 25, CRITICAL
  });
});

describe("seeded hazard library", () => {
  const hazards = HAZARD_LIBRARY.flatMap((a) => a.hazards);

  it("reproduces the source assessment's ratings exactly", () => {
    const rated = hazards.map((h) => [
      score(h.before.likelihood, h.before.severity).rating,
      score(h.after.likelihood, h.after.severity).rating,
    ]);
    expect(rated).toEqual([
      [15, 10],
      [12, 6],
      [12, 4],
      [16, 4],
    ]);
  });

  it("has controls that actually reduce every hazard", () => {
    for (const h of hazards) {
      const before = score(h.before.likelihood, h.before.severity);
      const after = score(h.after.likelihood, h.after.severity);
      expect(controlsAreIneffective(before, after), h.id).toBe(false);
      expect(h.controls.length, h.id).toBeGreaterThan(0);
    }
  });

  it("leaves no residual risk above MEDIUM", () => {
    for (const h of hazards) {
      expect(requiresEscalation(score(h.after.likelihood, h.after.severity)), h.id).toBe(false);
    }
  });
});
