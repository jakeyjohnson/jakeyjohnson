import type { JobCode } from "./job-code";

/**
 * The base document set.
 *
 * One type per document a production company has to produce. The shapes here
 * are deliberately close to what the paperwork actually contains, rather than
 * a generic "document with sections", because the value is in the fields: an
 * insurance expiry date the app can warn about, a lead time it can count back
 * from, a COSHH substance it can cross-reference against the method statement.
 */

export type DocumentKind =
  | "risk-assessment"
  | "method-statement"
  | "coshh-assessment"
  | "lifting-plan"
  | "site-induction"
  | "accident-report"
  | "production-schedule"
  | "call-sheet"
  | "purchase-order"
  | "procurement-schedule"
  | "supplier-register"
  | "subcontractor-questionnaire"
  | "licence-register";

// --- COSHH ------------------------------------------------------------------

/**
 * A COSHH assessment, one per substance.
 *
 * The existing method statement commits to "COSHH assessment implemented" for
 * haze fluid but no such assessment exists in the pack. This is the document
 * that claim depends on.
 */
export interface CoshhAssessment {
  substance: string;
  supplier: string;
  /** Safety data sheet reference and revision date. */
  sdsReference: string;
  /** GHS hazard statements, e.g. "H319 Causes serious eye irritation". */
  hazardStatements: string[];
  /** How it gets into someone: inhalation, skin, eyes, ingestion. */
  exposureRoutes: string[];
  /** Who is exposed and for how long. */
  personsExposed: string;
  workplaceExposureLimit?: string;
  controls: string[];
  ppe: string[];
  storage: string;
  disposal: string;
  spillageProcedure: string;
  firstAid: { route: string; action: string }[];
  fireFighting: string;
  assessedBy: string;
  assessedOn: string;
}

// --- Lifting ----------------------------------------------------------------

/** A lift, planned under LOLER 1998 by an appointed person. */
export interface LiftingPlan {
  /** Whose responsibility the lift is, by name. LOLER requires this. */
  appointedPerson: string;
  liftCategory: "Basic" | "Standard" | "Complex";
  description: string;
  loads: {
    item: string;
    weightKg: number;
    dimensions: string;
    attachmentPoints: string;
  }[];
  equipment: {
    item: string;
    swlKg: number;
    /** Thorough examination certificate reference and date. */
    certificate: string;
  }[];
  groundConditions: string;
  exclusionZone: string;
  communications: string;
  weatherLimits: string;
  sequence: string[];
  emergencyProcedure: string;
  plannedBy: string;
  plannedOn: string;
}

/** Total weight of a lift, for checking against equipment capacity. */
export function totalLoadKg(plan: LiftingPlan): number {
  return plan.loads.reduce((sum, load) => sum + load.weightKg, 0);
}

/**
 * Equipment whose safe working load is under the total load.
 *
 * A lifting plan that specifies gear too light for the load is the kind of
 * error that kills people, and it is arithmetic, so the app should do it.
 */
export function underCapacity(plan: LiftingPlan): LiftingPlan["equipment"] {
  const total = totalLoadKg(plan);
  return plan.equipment.filter((item) => item.swlKg < total);
}

// --- Induction and incidents ------------------------------------------------

export interface SiteInduction {
  venue: string;
  inductedBy: string;
  briefingPoints: { topic: string; detail: string }[];
  emergencyArrangements: string[];
  /** Roles expected to sign. Names are filled in on site. */
  attendeeRoles: string[];
}

/**
 * Accident and near miss report.
 *
 * Every risk assessment in the source pack says it is reviewed "In event of
 * Accident or Near Miss", which requires a form for recording one.
 */
export interface AccidentReport {
  /** Blank on issue: this is a form, completed when something happens. */
  riddorReportable?: boolean;
}

// --- Schedule ---------------------------------------------------------------

export interface SchedulePhase {
  name: string;
  start: string;
  end: string;
  owner: string;
  /** Phases this one cannot start before. */
  dependsOn?: string[];
  notes?: string;
}

export interface ProductionSchedule {
  phases: SchedulePhase[];
  milestones: { name: string; date: string; owner: string }[];
}

export interface CallSheet {
  date: string;
  venue: string;
  address: string;
  calls: { time: string; activity: string; who: string }[];
  contacts: { role: string; name: string; phone: string }[];
  /** Nearest A&E, assembly point, first aider. */
  emergency: { label: string; detail: string }[];
  notes?: string;
}

// --- Procurement ------------------------------------------------------------

export interface PurchaseOrderLine {
  description: string;
  quantity: number;
  unit: string;
  unitPricePence: number;
}

export interface PurchaseOrder {
  /** PO number, issued from the register like any other code. */
  code: JobCode;
  supplier: string;
  supplierContact: string;
  deliverTo: string;
  requiredBy: string;
  lines: PurchaseOrderLine[];
  /** Percentage, e.g. 20 for UK standard rate. */
  vatRate: number;
  paymentTerms: string;
  raisedBy: string;
  raisedOn: string;
  notes?: string;
}

export interface ProcurementItem {
  item: string;
  supplier: string;
  /** Working days between order and delivery. */
  leadTimeDays: number;
  requiredOnSite: string;
  budgetPence: number;
  status: "to-order" | "quoted" | "ordered" | "delivered" | "cancelled";
  poCode?: string;
}

// --- Suppliers and licences -------------------------------------------------

export interface Supplier {
  name: string;
  category: string;
  contact: string;
  phone: string;
  email: string;
  /** Public liability insurance expiry. Warned on when close. */
  insuranceExpiry?: string;
  insuredTo?: string;
  accreditations: string[];
  approved: boolean;
  notes?: string;
}

export interface Licence {
  name: string;
  /** Who issues it: local authority, venue, Civil Aviation Authority. */
  authority: string;
  reference: string;
  appliedOn?: string;
  grantedOn?: string;
  expiresOn?: string;
  owner: string;
  status: "not-started" | "applied" | "granted" | "refused" | "expired";
  notes?: string;
}

export interface SubcontractorQuestionnaire {
  /** Blank on issue: sent to a subcontractor to complete and return. */
  sections: { heading: string; questions: string[] }[];
}

// --- Expiry checking --------------------------------------------------------

export type ExpiryState = "ok" | "expiring" | "expired" | "unknown";

/**
 * How an expiry date stands relative to a reference date.
 *
 * Used on both supplier insurance and licences. A supplier whose public
 * liability lapses mid-build is a problem discovered far too late on site,
 * and it is a date comparison, so the app should do it rather than a person.
 */
export function expiryState(
  expires: string | undefined,
  asOf: Date = new Date(),
  warnWithinDays = 30,
): ExpiryState {
  if (!expires) return "unknown";
  const date = new Date(expires);
  if (Number.isNaN(date.getTime())) return "unknown";

  const days = Math.floor((date.getTime() - asOf.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= warnWithinDays) return "expiring";
  return "ok";
}

/** Money is held in pence throughout, so totals never drift on rounding. */
export function formatPence(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(Math.round(pence));
  return `${sign}£${(abs / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface OrderTotals {
  netPence: number;
  vatPence: number;
  grossPence: number;
}

export function orderTotals(order: PurchaseOrder): OrderTotals {
  const netPence = order.lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPricePence),
    0,
  );
  // Round VAT once on the total rather than per line, which is what HMRC
  // expects and what a supplier's own invoice will show.
  const vatPence = Math.round((netPence * order.vatRate) / 100);
  return { netPence, vatPence, grossPence: netPence + vatPence };
}

/**
 * The date an item has to be ordered by to arrive on time.
 *
 * Counts back over working days only, because suppliers quote lead times in
 * working days and a weekend silently eats two of them.
 */
export function orderByDate(item: ProcurementItem): string {
  const required = new Date(item.requiredOnSite);
  if (Number.isNaN(required.getTime())) return "—";

  const date = new Date(required);
  let remaining = item.leadTimeDays;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

/** Items whose order-by date has already passed. */
export function overdueItems(
  items: ProcurementItem[],
  asOf: Date = new Date(),
): ProcurementItem[] {
  return items.filter((item) => {
    if (item.status === "ordered" || item.status === "delivered" || item.status === "cancelled") {
      return false;
    }
    const by = orderByDate(item);
    return by !== "—" && new Date(by) < asOf;
  });
}
