import { Packer, Paragraph, Table } from "docx";
import type { Branding } from "@/domain/branding";
import { formatJobCode, type JobCode } from "@/domain/job-code";
import type {
  CoshhAssessment,
  LiftingPlan,
  SiteInduction,
} from "@/domain/documents";
import { totalLoadKg, underCapacity } from "@/domain/documents";
import {
  BAND_FILL,
  blankRows,
  body,
  buildDocument,
  bullet,
  factTable,
  gridTable,
  heading,
  shadedCell,
  signatureRows,
  titleBlock,
} from "./shared";

/** COSHH assessment, one per substance. */
export async function renderCoshhAssessment(
  assessment: CoshhAssessment,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock("COSHH Assessment", formatJobCode(code), branding, assessment.substance),

    factTable([
      ["Substance", assessment.substance],
      ["Supplier", assessment.supplier],
      ["Safety data sheet", assessment.sdsReference],
      ["Workplace exposure limit", assessment.workplaceExposureLimit ?? "None assigned"],
    ]),

    heading("Hazards", branding),
    ...assessment.hazardStatements.map(bullet),

    heading("Routes of exposure", branding),
    ...assessment.exposureRoutes.map(bullet),

    heading("Persons exposed", branding),
    body(assessment.personsExposed),

    heading("Control measures", branding),
    ...assessment.controls.map(bullet),

    heading("Personal protective equipment", branding),
    ...assessment.ppe.map(bullet),

    heading("Storage, disposal and spillage", branding),
    factTable([
      ["Storage", assessment.storage],
      ["Disposal", assessment.disposal],
      ["Spillage", assessment.spillageProcedure],
      ["Fire fighting", assessment.fireFighting],
    ]),

    heading("First aid", branding),
    gridTable(
      [
        { header: "Route", width: 25 },
        { header: "Action", width: 75 },
      ],
      assessment.firstAid.map((entry) => [entry.route, entry.action]),
    ),

    heading("Assessment", branding),
    factTable([
      ["Assessed by", assessment.assessedBy],
      ["Date", assessment.assessedOn],
      ["Review", "On change of substance, supplier or method, or after any incident"],
    ]),
  ];

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `COSHH Assessment ${formatJobCode(code)}`,
      children,
    }),
  );
}

/**
 * Lifting plan.
 *
 * Where equipment is specified below the total load, the document says so on
 * its face in a shaded row. A lifting plan that quietly specifies gear too
 * light for the load is exactly the failure this document exists to prevent,
 * and it is arithmetic.
 */
export async function renderLiftingPlan(
  plan: LiftingPlan,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const total = totalLoadKg(plan);
  const undersized = new Set(underCapacity(plan).map((item) => item.item));

  const children: (Paragraph | Table)[] = [
    ...titleBlock("Lifting Plan", formatJobCode(code), branding, plan.description),

    factTable([
      ["Appointed person", plan.appointedPerson],
      ["Lift category", plan.liftCategory],
      ["Total load", total > 0 ? `${total} kg` : "To be confirmed"],
    ]),

    heading("Loads", branding),
    gridTable(
      [
        { header: "Item", width: 34 },
        { header: "Weight (kg)", width: 16 },
        { header: "Dimensions", width: 25 },
        { header: "Attachment points", width: 25 },
      ],
      plan.loads.map((load) => [
        load.item,
        String(load.weightKg),
        load.dimensions,
        load.attachmentPoints,
      ]),
      { emptyMessage: "No loads entered. Weigh or obtain certified weights before lifting." },
    ),

    heading("Lifting equipment", branding),
    gridTable(
      [
        { header: "Item", width: 34 },
        { header: "SWL (kg)", width: 16 },
        { header: "Thorough examination", width: 34 },
        { header: "Capacity", width: 16 },
      ],
      plan.equipment.map((item) => [
        item.item,
        String(item.swlKg),
        item.certificate,
        undersized.has(item.item)
          ? shadedCell("UNDER TOTAL LOAD", BAND_FILL.CRITICAL)
          : shadedCell("OK", BAND_FILL.LOW),
      ]),
      {
        emptyMessage:
          "No equipment entered. Every item must carry an in-date thorough examination certificate.",
      },
    ),
  ];

  if (undersized.size > 0) {
    children.push(
      heading("Capacity warning", branding),
      body(
        `Equipment listed above has a safe working load below the total load of ${total} kg. Do not proceed until the equipment or the lift plan is changed.`,
        { bold: true },
      ),
    );
  }

  children.push(
    heading("Site conditions and controls", branding),
    factTable([
      ["Ground conditions", plan.groundConditions],
      ["Exclusion zone", plan.exclusionZone],
      ["Communications", plan.communications],
      ["Weather limits", plan.weatherLimits],
    ]),

    heading("Sequence of operations", branding),
    ...plan.sequence.map((step, i) => body(`${i + 1}. ${step}`)),

    heading("Emergency procedure", branding),
    body(plan.emergencyProcedure),

    heading("Briefing record", branding),
    body("Everyone involved in the lift has been briefed on this plan:"),
    signatureRows(["Appointed person", "Signaller", "Slinger", "Operator", "Crew"]),
  );

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Lifting Plan ${formatJobCode(code)}`,
      children,
    }),
  );
}

/** Site induction record, signed on arrival. */
export async function renderSiteInduction(
  induction: SiteInduction,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock("Site Induction Record", formatJobCode(code), branding, induction.venue),

    factTable([
      ["Venue", induction.venue],
      ["Inducted by", induction.inductedBy],
      ["Date", ""],
    ]),

    heading("Briefing", branding),
    gridTable(
      [
        { header: "Topic", width: 26 },
        { header: "Covered", width: 74 },
      ],
      induction.briefingPoints.map((point) => [point.topic, point.detail]),
    ),

    heading("Emergency arrangements", branding),
    ...induction.emergencyArrangements.map(bullet),

    heading("Attendance", branding),
    body(
      "Everyone signing below confirms they have received this induction, understood it, and will work to it. Anyone may stop work they believe to be unsafe.",
    ),
    gridTable(
      [
        { header: "Name", width: 26 },
        { header: "Company", width: 22 },
        { header: "Role", width: 20 },
        { header: "Signature", width: 20 },
        { header: "Time", width: 12 },
      ],
      blankRows(14, 5),
    ),
  ];

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Site Induction ${formatJobCode(code)}`,
      children,
    }),
  );
}

/**
 * Accident and near miss report form.
 *
 * Issued blank. Every risk assessment in the pack is reviewed "In event of
 * Accident or Near Miss", which is only possible if there is something to
 * record one on.
 */
export async function renderAccidentReport(
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock(
      "Accident & Near Miss Report",
      formatJobCode(code),
      branding,
      "Report near misses as well as injuries. A near miss is a free warning.",
    ),

    heading("1. Person involved", branding),
    factTable([
      ["Name", ""],
      ["Company / role", ""],
      ["Contact number", ""],
    ]),

    heading("2. What happened", branding),
    factTable([
      ["Date and time", ""],
      ["Exact location", ""],
      ["Activity underway", ""],
      ["Description of events", ""],
      ["Injury or damage, if any", ""],
      ["Treatment given", ""],
    ]),

    heading("3. Witnesses", branding),
    gridTable(
      [
        { header: "Name", width: 34 },
        { header: "Company", width: 33 },
        { header: "Contact", width: 33 },
      ],
      blankRows(3, 3),
    ),

    heading("4. Immediate action taken", branding),
    factTable([
      ["Made safe by", ""],
      ["Action taken", ""],
    ]),

    heading("5. Cause and prevention", branding),
    factTable([
      ["Underlying cause", ""],
      ["What will prevent recurrence", ""],
      ["Risk assessment reference to be reviewed", ""],
      ["Review completed by / date", ""],
    ]),

    heading("6. Reporting", branding),
    body(
      "Is this reportable under RIDDOR 2013? Specified injuries, over-seven-day incapacitation, dangerous occurrences and occupational diseases are reportable to the HSE. If in doubt, ask before deciding it is not.",
    ),
    factTable([
      ["RIDDOR reportable", "Yes / No"],
      ["Reported by / date", ""],
      ["HSE reference", ""],
    ]),

    heading("7. Sign-off", branding),
    signatureRows(["Reported by", "Production Manager", "Reviewed by"]),
  ];

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Accident Report ${formatJobCode(code)}`,
      children,
    }),
  );
}
