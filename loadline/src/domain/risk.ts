/**
 * Risk scoring.
 *
 * Reverse-engineered from the existing Mega Events risk assessment pack
 * ("General Risk Assessment Pack Updated 2025 Version 1.1"), which uses a 5x5
 * likelihood x severity matrix. The scales below are taken verbatim from the
 * legend printed at the foot of every assessment.
 */

export const LIKELIHOOD_SCALE = {
  1: "Very Unlikely to Occur",
  2: "Unlikely to Occur",
  3: "May Occur",
  4: "Likely to Occur",
  5: "Certain to Occur",
} as const;

export const SEVERITY_SCALE = {
  1: "Very Minor Injury",
  2: "Minor Injury",
  3: "Time Off due to Injury",
  4: "Serious Injury",
  5: "Death",
} as const;

export type Likelihood = keyof typeof LIKELIHOOD_SCALE;
export type Severity = keyof typeof SEVERITY_SCALE;

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskScore {
  likelihood: Likelihood;
  severity: Severity;
  rating: number;
  band: RiskBand;
}

/**
 * Band thresholds are inferred, not documented. Every banded rating in the
 * source assessments is consistent with these cuts: 4 and 6 are LOW, 10 and 12
 * are MEDIUM, 15 and 16 are HIGH. The pack never printed a band above HIGH, so
 * CRITICAL is our addition for ratings of 20 and 25 — a 5x5 matrix that tops
 * out at HIGH gives a production manager nowhere to escalate.
 *
 * Each band's `max` is the highest rating that still falls in it.
 */
export const DEFAULT_BANDS: ReadonlyArray<{ band: RiskBand; max: number }> = [
  { band: "LOW", max: 8 },
  { band: "MEDIUM", max: 14 },
  { band: "HIGH", max: 19 },
  { band: "CRITICAL", max: 25 },
];

export function bandFor(
  rating: number,
  bands: ReadonlyArray<{ band: RiskBand; max: number }> = DEFAULT_BANDS,
): RiskBand {
  for (const { band, max } of bands) {
    if (rating <= max) return band;
  }
  return bands[bands.length - 1].band;
}

export function score(
  likelihood: Likelihood,
  severity: Severity,
  bands?: ReadonlyArray<{ band: RiskBand; max: number }>,
): RiskScore {
  const rating = likelihood * severity;
  return { likelihood, severity, rating, band: bandFor(rating, bands) };
}

/**
 * True when controls have not moved the needle. Worth surfacing in the UI: a
 * hazard whose residual risk equals its pre-control risk usually means the
 * controls column was filled in with boilerplate.
 */
export function controlsAreIneffective(before: RiskScore, after: RiskScore): boolean {
  return after.rating >= before.rating;
}

/**
 * A residual CRITICAL or HIGH rating is the thing a production manager must not
 * miss, and the thing a client's safety officer will find first.
 */
export function requiresEscalation(after: RiskScore): boolean {
  return after.band === "HIGH" || after.band === "CRITICAL";
}
