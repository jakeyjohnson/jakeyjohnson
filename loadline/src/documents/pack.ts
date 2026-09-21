import { formatJobCode, type JobCode } from "@/domain/job-code";
import type { Project, Workspace } from "@/domain/types";
import type { DocumentKind, ProductionSchedule, PurchaseOrder } from "@/domain/documents";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { methodStatementFor } from "@/domain/method-statement-template";
import {
  SCHEDULE_PHASES,
  SUBCONTRACTOR_QUESTIONNAIRE,
  baseLicenceRegister,
  baseLiftingPlan,
  baseProcurementSchedule,
  baseSiteInduction,
  hazeFluidCoshh,
} from "@/domain/document-defaults";
import type { ProjectSection } from "@/store/types";
import { renderRiskAssessment } from "./risk-assessment";
import { renderMethodStatement } from "./method-statement";
import {
  renderAccidentReport,
  renderCoshhAssessment,
  renderLiftingPlan,
  renderSiteInduction,
} from "./safety";
import { baseCallSheet, renderCallSheet, renderProductionSchedule } from "./schedule";
import { renderProcurementSchedule, renderPurchaseOrder } from "./procurement";
import {
  renderLicenceRegister,
  renderSubcontractorQuestionnaire,
  renderSupplierRegister,
} from "./suppliers";

/**
 * The base pack.
 *
 * Generating a project's documentation produces every document below in one
 * pass, filed into the folder it belongs in. The set is deliberately complete
 * rather than minimal: a document that does not exist is one nobody remembers
 * to write, and the gaps in the source pack — no COSHH assessment despite the
 * method statement promising one, no accident form despite every risk
 * assessment being reviewed on accidents — are exactly that failure.
 *
 * Documents are starting points, not finished paperwork. Several carry
 * explicit placeholders that must be completed before issue.
 */

export interface GeneratedDocument {
  kind: DocumentKind;
  section: ProjectSection;
  filename: string;
  contents: Buffer;
  /** True where the document contains placeholders needing a human. */
  needsCompletion: boolean;
}

export interface PackDefinition {
  kind: DocumentKind;
  section: ProjectSection;
  label: string;
  /** What this document is for, shown in the app. */
  purpose: string;
  needsCompletion: boolean;
}

/** The pack, in the order it is generated and listed. */
export const PACK: PackDefinition[] = [
  {
    kind: "risk-assessment",
    section: "01 RAMS",
    label: "Risk Assessment",
    purpose: "Hazards, controls and residual risk for every activity on the job.",
    needsCompletion: false,
  },
  {
    kind: "method-statement",
    section: "01 RAMS",
    label: "Method Statement",
    purpose: "The safe system of work, from arrival through get-out.",
    needsCompletion: false,
  },
  {
    kind: "coshh-assessment",
    section: "01 RAMS",
    label: "COSHH Assessment",
    purpose:
      "Required by the method statement's haze commitments. Hazard data must come from the product's safety data sheet.",
    needsCompletion: true,
  },
  {
    kind: "lifting-plan",
    section: "01 RAMS",
    label: "Lifting Plan",
    purpose:
      "LOLER lift plan with an appointed person. Checks equipment capacity against total load.",
    needsCompletion: true,
  },
  {
    kind: "site-induction",
    section: "01 RAMS",
    label: "Site Induction Record",
    purpose: "Briefing content and the attendance sheet crew sign on arrival.",
    needsCompletion: false,
  },
  {
    kind: "accident-report",
    section: "01 RAMS",
    label: "Accident & Near Miss Report",
    purpose: "Blank form. Every risk assessment is reviewed on accident or near miss.",
    needsCompletion: false,
  },
  {
    kind: "production-schedule",
    section: "03 Schedule",
    label: "Production Schedule",
    purpose: "Phases, owners and milestones from planning through derig.",
    needsCompletion: true,
  },
  {
    kind: "call-sheet",
    section: "03 Schedule",
    label: "Call Sheet",
    purpose: "Daily calls, contacts and emergency details for on site.",
    needsCompletion: true,
  },
  {
    kind: "procurement-schedule",
    section: "02 Procurement",
    label: "Procurement Schedule",
    purpose: "What to order, from whom, and the date it has to be ordered by.",
    needsCompletion: true,
  },
  {
    kind: "purchase-order",
    section: "02 Procurement",
    label: "Purchase Order",
    purpose: "Template order with computed totals and payment terms.",
    needsCompletion: true,
  },
  {
    kind: "supplier-register",
    section: "05 Suppliers",
    label: "Approved Supplier Register",
    purpose: "Suppliers, accreditations and insurance expiry, flagged when lapsing.",
    needsCompletion: true,
  },
  {
    kind: "subcontractor-questionnaire",
    section: "05 Suppliers",
    label: "Subcontractor Questionnaire",
    purpose: "Sent to subcontractors before work is placed with them.",
    needsCompletion: false,
  },
  {
    kind: "licence-register",
    section: "04 Licences",
    label: "Licence & Permissions Register",
    purpose: "Licences to work through, with authority, owner and status.",
    needsCompletion: true,
  },
];

/** Filename for a document. The job code makes it sortable and traceable. */
export function filenameFor(definition: PackDefinition, code: JobCode): string {
  return `${definition.label} ${formatJobCode(code)}.docx`;
}

/**
 * Generates the whole base pack for a project.
 *
 * Every document carries the project's job code, so a pack that arrives at a
 * venue in pieces can be reassembled, and a stale document is obvious.
 */
export async function generatePack(
  project: Project,
  workspace: Workspace,
  options: { asOf?: Date } = {},
): Promise<GeneratedDocument[]> {
  const asOf = options.asOf ?? new Date();
  const today = asOf.toISOString().slice(0, 10);
  const code = project.code;
  const { branding, packVersion } = workspace;
  const assessedBy = project.productionManager || workspace.companyName;

  const buffers = new Map<DocumentKind, Buffer>();

  buffers.set(
    "risk-assessment",
    await renderRiskAssessment(
      {
        code,
        projectId: project.id,
        circulation: workspace.defaultCirculation,
        activities: HAZARD_LIBRARY,
        assessedBy,
        assessedOn: today,
        reviewTrigger: "In event of Accident or Near Miss",
        packVersion,
      },
      branding,
    ),
  );

  buffers.set(
    "method-statement",
    await renderMethodStatement(methodStatementFor(project, code), branding, packVersion),
  );

  buffers.set(
    "coshh-assessment",
    await renderCoshhAssessment(hazeFluidCoshh(assessedBy, today), code, branding, packVersion),
  );

  buffers.set(
    "lifting-plan",
    await renderLiftingPlan(baseLiftingPlan(assessedBy, today), code, branding, packVersion),
  );

  buffers.set(
    "site-induction",
    await renderSiteInduction(baseSiteInduction(project, assessedBy), code, branding, packVersion),
  );

  buffers.set("accident-report", await renderAccidentReport(code, branding, packVersion));

  buffers.set(
    "production-schedule",
    await renderProductionSchedule(
      baseProductionSchedule(project),
      project,
      code,
      branding,
      packVersion,
    ),
  );

  buffers.set(
    "call-sheet",
    await renderCallSheet(baseCallSheet(project), project, code, branding, packVersion),
  );

  buffers.set(
    "procurement-schedule",
    await renderProcurementSchedule(
      baseProcurementSchedule(project.startDate ?? today),
      project,
      code,
      branding,
      packVersion,
      asOf,
    ),
  );

  buffers.set(
    "purchase-order",
    await renderPurchaseOrder(basePurchaseOrder(project, code, today), project, branding, packVersion),
  );

  buffers.set(
    "supplier-register",
    await renderSupplierRegister([], code, branding, packVersion, asOf),
  );

  buffers.set(
    "subcontractor-questionnaire",
    await renderSubcontractorQuestionnaire(
      SUBCONTRACTOR_QUESTIONNAIRE,
      code,
      branding,
      packVersion,
    ),
  );

  buffers.set(
    "licence-register",
    await renderLicenceRegister(baseLicenceRegister(assessedBy), code, branding, packVersion, asOf),
  );

  return PACK.map((definition) => {
    const contents = buffers.get(definition.kind);
    if (!contents) {
      // A definition with no generator is a programming error, not a runtime
      // condition — fail loudly rather than silently shipping a short pack.
      throw new Error(`No generator produced a document for ${definition.kind}`);
    }
    return {
      kind: definition.kind,
      section: definition.section,
      filename: filenameFor(definition, code),
      contents,
      needsCompletion: definition.needsCompletion,
    };
  });
}

/**
 * Schedule roughed out across the project's own dates.
 *
 * Phases are spread evenly, which is wrong for any real job but puts every
 * phase on the page with a date to argue with. An empty schedule gets ignored;
 * a wrong one gets corrected.
 */
export function baseProductionSchedule(project: Project): ProductionSchedule {
  const phases = [...SCHEDULE_PHASES];
  const start = project.startDate ? new Date(project.startDate) : null;
  const end = project.endDate ? new Date(project.endDate) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return {
      phases: phases.map((phase) => ({
        name: phase.name,
        start: "",
        end: "",
        owner: phase.owner,
        notes: "Dates to be set",
      })),
      milestones: [],
    };
  }

  const finish = end && !Number.isNaN(end.getTime()) ? end : start;
  const totalDays = Math.max(
    1,
    Math.round((finish.getTime() - start.getTime()) / 86_400_000),
  );
  const step = totalDays / phases.length;

  const dated = phases.map((phase, i) => {
    const from = new Date(start);
    from.setDate(from.getDate() + Math.round(i * step));
    const to = new Date(start);
    to.setDate(to.getDate() + Math.round((i + 1) * step));
    return {
      name: phase.name,
      start: from.toISOString().slice(0, 10),
      end: to.toISOString().slice(0, 10),
      owner: phase.owner,
      notes: "Indicative, confirm against the venue's schedule",
    };
  });

  return {
    phases: dated,
    milestones: [
      { name: "Design sign-off", date: dated[0].end, owner: "Production Manager" },
      { name: "All orders placed", date: dated[1].end, owner: "Production Manager" },
      { name: "Load-in begins", date: dated[5].start, owner: "Technical Manager" },
      { name: "First performance", date: dated[8].start, owner: "Stage Manager" },
      { name: "Get-out complete", date: dated[dated.length - 1].end, owner: "Production Manager" },
    ],
  };
}

/** A purchase order template, with terms filled in and lines left blank. */
export function basePurchaseOrder(
  project: Project,
  code: JobCode,
  raisedOn: string,
): PurchaseOrder {
  return {
    code,
    supplier: "",
    supplierContact: "",
    deliverTo: project.venues[0] ?? "",
    requiredBy: project.startDate ?? "",
    lines: [],
    vatRate: 20,
    paymentTerms: "30 days from receipt of a valid invoice, unless agreed otherwise in writing.",
    raisedBy: project.productionManager,
    raisedOn,
  };
}
