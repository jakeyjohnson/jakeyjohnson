import { describe, expect, it } from "vitest";
import {
  findStaleCodes,
  formatJobCode,
  nextInSeries,
  nextRevision,
  parseJobCode,
  requireJobCode,
} from "../job-code";

describe("parsing", () => {
  it.each(["PROD2026-002a", "SM2026-003a", "PROD2017-002a", "PROD2026-006a"])(
    "round-trips %s, a code from the real document set",
    (raw) => {
      const code = requireJobCode(raw);
      expect(formatJobCode(code)).toBe(raw);
    },
  );

  it("reads the parts out", () => {
    expect(parseJobCode("PROD2026-002a")).toEqual({
      prefix: "PROD",
      year: 2026,
      sequence: 2,
      revision: "a",
    });
  });

  it.each(["PROD26-002a", "prod2026-002a", "PROD2026-2a", "PROD2026-002", "", "PROD2026-002A"])(
    "rejects %s",
    (raw) => {
      expect(parseJobCode(raw)).toBeNull();
    },
  );

  it("tolerates surrounding whitespace, which filenames carry", () => {
    // "PP Risk Assessment PROD2026-002a .docx" has a trailing space before .docx
    expect(parseJobCode(" PROD2026-002a ")).not.toBeNull();
  });
});

describe("revisions", () => {
  it("bumps the letter", () => {
    expect(formatJobCode(nextRevision(requireJobCode("PROD2026-002a")))).toBe("PROD2026-002b");
  });

  it("refuses to wrap past z rather than reissuing a colliding code", () => {
    expect(() => nextRevision(requireJobCode("PROD2026-002z"))).toThrow(/exhausted/);
  });
});

describe("issuing", () => {
  it("takes the next free sequence in the series", () => {
    const issued = ["PROD2026-002a", "PROD2026-006a", "SM2026-003a"].map(requireJobCode);
    expect(formatJobCode(nextInSeries("PROD", 2026, issued))).toBe("PROD2026-007a");
  });

  it("restarts sequences each year, as the existing codes do", () => {
    const issued = ["PROD2017-002a"].map(requireJobCode);
    expect(formatJobCode(nextInSeries("PROD", 2026, issued))).toBe("PROD2026-001a");
  });

  it("starts a brand new series at 001", () => {
    expect(formatJobCode(nextInSeries("FAB", 2026, []))).toBe("FAB2026-001a");
  });
});

describe("stale code detection", () => {
  /**
   * The exact defect in the existing pack: a file named PROD2026-002a whose
   * body reads "RISK ASSESSMENT NUMBER PROD2017-002a".
   */
  it("catches a stale year copied forward in the body", () => {
    const body = "RISK ASSESSMENT NUMBER PROD2017-002a\n\nThis Assessment should be circulated to:";
    expect(findStaleCodes(body, requireJobCode("PROD2026-002a"))).toEqual(["PROD2017-002a"]);
  });

  it("is quiet when the body agrees with the document", () => {
    expect(findStaleCodes("RISK ASSESSMENT NUMBER PROD2026-002a", requireJobCode("PROD2026-002a"))).toEqual([]);
  });
});
