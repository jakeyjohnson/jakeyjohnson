import type { MethodStatement, Project } from "./types";
import type { JobCode } from "./job-code";

/**
 * Base method statement.
 *
 * The 13 sections and their default content come from
 * "PP BASE Method_Statement.docx". That file is a touring theatre statement
 * with the production details typed straight into the body, so reusing it
 * means find-and-replacing a company name and hoping. Here the boilerplate is
 * separated from the project facts, which are injected.
 */

export const STANDARDS_AND_GUIDANCE = [
  "ABTT Technical Standards for Places of Entertainment",
  "Health and Safety at Work etc. Act 1974",
  "Management of Health and Safety at Work Regulations 1999",
  "COSHH Regulations 2002",
  "Work at Height Regulations 2005",
  "Electricity at Work Regulations 1989",
  "PUWER 1998",
];

export const DEFAULT_PERSONNEL = [
  { role: "Production Manager", responsibility: "Overall compliance" },
  { role: "Technical Manager", responsibility: "Implementation of RAMS" },
  { role: "Stage Manager", responsibility: "Operational control during performance" },
  { role: "Crew", responsibility: "Competent execution of tasks" },
];

export const DEFAULT_METHOD_OF_WORK = [
  { stage: "Arrival & Induction", detail: "Venue briefing and hazard review" },
  { stage: "Load-in", detail: "Controlled unloading using safe techniques" },
  { stage: "Installation", detail: "Assembly of set, rigging, LX and sound" },
  { stage: "Testing", detail: "Full system checks" },
  { stage: "Performance", detail: "Controlled operation" },
  { stage: "Get-out", detail: "Safe dismantling and loading" },
];

export const DEFAULT_PLANT_AND_EQUIPMENT = [
  "Lighting and rigging systems",
  "Audio systems",
  "Set and staging",
  "Haze machines (water-based)",
  "Access equipment (ladders, towers)",
  "Power distribution systems",
];

export const DEFAULT_COSHH = [
  "Only approved fluids used with safety data sheets available",
  "COSHH assessment implemented",
  "Ventilation confirmed prior to use",
  "Fire detection systems isolated only with venue approval",
  "Exposure minimised to cast, crew, and audience",
  "Used only by trained operators",
];

export const DEFAULT_RISK_CONTROLS = [
  "Manual handling controls in place",
  "Work at height controlled via suitable access equipment",
  "Electrical systems installed by competent persons",
  "Cable management to prevent trips",
  "Fire exits maintained clear",
];

export const DEFAULT_PPE = [
  "Safety footwear",
  "Gloves",
  "High-visibility clothing",
  "Head protection where overhead work exists",
];

export const DEFAULT_EMERGENCY = [
  "Venue emergency procedures followed",
  "Fire evacuation routes identified",
  "First aid provision confirmed",
];

export const DEFAULT_ENVIRONMENTAL = [
  "Minimise waste and noise",
  "Responsible disposal of materials",
];

export const DEFAULT_MONITORING = [
  "Ongoing supervision by Technical Manager",
  "Daily briefings and reviews",
];

export const DEFAULT_DESCRIPTION_OF_WORKS =
  "This document outlines safe systems of work for the transport, installation, operation and dismantling of a professional touring theatre production, including staging, lighting, sound, and atmospheric effects (haze).";

/** Builds a method statement for a project from the base template. */
export function methodStatementFor(
  project: Project,
  code: JobCode,
  overrides: Partial<MethodStatement> = {},
): MethodStatement {
  return {
    code,
    projectId: project.id,
    production: project.name,
    company: project.company,
    dates: formatDateRange(project.startDate, project.endDate),
    venues: project.venues.join(", "),
    productionManager: project.productionManager,
    descriptionOfWorks: DEFAULT_DESCRIPTION_OF_WORKS,
    standards: [...STANDARDS_AND_GUIDANCE],
    personnel: DEFAULT_PERSONNEL.map((p) => ({ ...p })),
    plantAndEquipment: [...DEFAULT_PLANT_AND_EQUIPMENT],
    methodOfWork: DEFAULT_METHOD_OF_WORK.map((s) => ({ ...s })),
    coshh: [...DEFAULT_COSHH],
    riskControls: [...DEFAULT_RISK_CONTROLS],
    ppe: [...DEFAULT_PPE],
    emergency: [...DEFAULT_EMERGENCY],
    environmental: [...DEFAULT_ENVIRONMENTAL],
    monitoring: [...DEFAULT_MONITORING],
    ...overrides,
  };
}

function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${start} to ${end}`;
  if (start) return start;
  return "TBC";
}
