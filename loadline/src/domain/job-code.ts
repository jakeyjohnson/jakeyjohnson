/**
 * Job codes.
 *
 * The existing document set numbers every assessment with a code of the form
 * PROD2026-002a — a series prefix, the year, a zero-padded sequence and a
 * revision letter. SM2026-003a is the same shape on a different series.
 *
 * These codes are currently typed by hand, and they drift: the file named
 * "PP Risk Assessment PROD2026-002a.docx" carries the header
 * "RISK ASSESSMENT NUMBER PROD2017-002a" — a 2017 code sitting inside a 2026
 * document, copied forward through nine years of revisions. Codes are issued
 * here, from the workspace registry, so a human never retypes one.
 */

const CODE_PATTERN = /^([A-Z]{2,6})(\d{4})-(\d{3})([a-z])$/;

export interface JobCode {
  /** Series prefix, e.g. PROD (production) or SM (stage management). */
  prefix: string;
  year: number;
  /** Position within that prefix and year. */
  sequence: number;
  /** Revision, 'a' on first issue, bumped on every reissue. */
  revision: string;
}

export function formatJobCode(code: JobCode): string {
  const sequence = String(code.sequence).padStart(3, "0");
  return `${code.prefix}${code.year}-${sequence}${code.revision}`;
}

export function parseJobCode(raw: string): JobCode | null {
  const match = CODE_PATTERN.exec(raw.trim());
  if (!match) return null;
  return {
    prefix: match[1],
    year: Number(match[2]),
    sequence: Number(match[3]),
    revision: match[4],
  };
}

/** Throwing variant, for the boundaries where a malformed code is a bug. */
export function requireJobCode(raw: string): JobCode {
  const code = parseJobCode(raw);
  if (!code) throw new Error(`Not a valid job code: ${JSON.stringify(raw)}`);
  return code;
}

/**
 * Next revision of the same document. 'a' -> 'b' -> 'c'. Past 'z' we would need
 * a second letter, which no assessment has ever reached; fail loudly rather
 * than silently wrapping to something that collides with an issued code.
 */
export function nextRevision(code: JobCode): JobCode {
  if (code.revision === "z") {
    throw new Error(
      `${formatJobCode(code)} has exhausted single-letter revisions; the document needs reissuing under a new sequence number.`,
    );
  }
  const next = String.fromCharCode(code.revision.charCodeAt(0) + 1);
  return { ...code, revision: next };
}

/**
 * Next code in a series. Sequences restart each year, which is what the
 * existing codes imply (PROD2017-002a and PROD2026-002a coexist).
 */
export function nextInSeries(
  prefix: string,
  year: number,
  issued: readonly JobCode[],
): JobCode {
  const highest = issued
    .filter((c) => c.prefix === prefix && c.year === year)
    .reduce((max, c) => Math.max(max, c.sequence), 0);
  return { prefix, year, sequence: highest + 1, revision: "a" };
}

/**
 * Codes embedded in a document body should match the document's own code.
 * Where they do not, the body is stale — the failure mode found in the
 * existing pack.
 */
export function findStaleCodes(body: string, expected: JobCode): string[] {
  const expectedText = formatJobCode(expected);
  const found = body.match(/[A-Z]{2,6}\d{4}-\d{3}[a-z]/g) ?? [];
  return [...new Set(found)].filter((c) => c !== expectedText);
}
