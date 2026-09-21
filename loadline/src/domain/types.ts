import type { Likelihood, RiskScore, Severity } from "./risk";
import type { JobCode } from "./job-code";
import type { Branding } from "./branding";

/** Who a hazard puts at risk. Free text in the source pack; enumerated here so
 *  the app can answer "every assessment affecting performers". */
export type PersonAtRisk =
  | "Production Crew"
  | "Contractors"
  | "Performers"
  | "Venue Staff"
  | "Public"
  | "Drivers"
  | "Riggers";

export interface Control {
  id: string;
  /** One control measure. The source pack runs several together in a single
   *  cell; splitting them lets a control be reused and audited on its own. */
  text: string;
  /** Regulation or standard this control exists to satisfy, where known. */
  basis?: string;
}

export interface Hazard {
  id: string;
  /** Hazard and the harm it causes, as written on the assessment. */
  description: string;
  personsAtRisk: PersonAtRisk[];
  before: { likelihood: Likelihood; severity: Severity };
  controls: Control[];
  after: { likelihood: Likelihood; severity: Severity };
}

/** A unit of work being assessed, e.g. "Loading & Unloading of Equipment". */
export interface Activity {
  id: string;
  name: string;
  description: string;
  hazards: Hazard[];
}

export interface RiskAssessment {
  code: JobCode;
  projectId: string;
  /** "This Assessment should be circulated to: ..." */
  circulation: string[];
  activities: Activity[];
  assessedBy: string;
  assessedOn: string;
  /** The source pack reviews "In event of Accident or Near Miss". */
  reviewTrigger: string;
  packVersion: string;
}

/** The 13 sections of the base method statement, in order. */
export interface MethodStatement {
  code: JobCode;
  projectId: string;
  production: string;
  company: string;
  dates: string;
  venues: string;
  productionManager: string;
  descriptionOfWorks: string;
  standards: string[];
  personnel: { role: string; responsibility: string }[];
  plantAndEquipment: string[];
  methodOfWork: { stage: string; detail: string }[];
  coshh: string[];
  riskControls: string[];
  ppe: string[];
  emergency: string[];
  environmental: string[];
  monitoring: string[];
  preparedBy?: string;
  approvedBy?: string;
}

export type ProjectStatus =
  | "enquiry"
  | "quoted"
  | "confirmed"
  | "in-build"
  | "on-site"
  | "complete"
  | "cancelled";

export interface Project {
  id: string;
  code: JobCode;
  name: string;
  client: string;
  company: string;
  productionManager: string;
  status: ProjectStatus;
  venues: string[];
  startDate?: string;
  endDate?: string;
  /** Drive folder holding this project's documents. */
  folderId?: string;
}

/** Tenant configuration. Lives in the store, not a database. */
export interface Workspace {
  companyName: string;
  branding: Branding;
  /** Series prefixes this company issues codes under, e.g. PROD, SM. */
  seriesPrefixes: string[];
  issuedCodes: JobCode[];
  defaultCirculation: string[];
  packVersion: string;
  /** Identifier of the workspace container in whichever store backs it: a
   *  Drive folder id, or a directory path for the local store. */
  rootFolderId: string;
}

export interface ScoredHazard extends Hazard {
  beforeScore: RiskScore;
  afterScore: RiskScore;
}
