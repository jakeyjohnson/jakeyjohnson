import { AlignmentType, Document, Footer, Packer, Paragraph, TextRun } from "docx";
import type { MethodStatement } from "@/domain/types";
import type { Branding } from "@/domain/branding";
import { ooxmlColour } from "@/domain/branding";
import { formatJobCode } from "@/domain/job-code";
import { body, brandedHeader, bullet, footerText, heading } from "./shared";

/**
 * Renders a method statement as .docx, in the 13-section order of the existing
 * base document.
 *
 * The project facts in section 1 are injected rather than typed, which is the
 * point: the source base document had "PRINCESS PROMS" and a named production
 * manager baked into the boilerplate, so every reuse started with a
 * find-and-replace that someone eventually forgets.
 */
export async function renderMethodStatement(
  statement: MethodStatement,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: statement.production.toUpperCase(),
          bold: true,
          size: 32,
          color: ooxmlColour(branding.theme.primary),
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "METHOD STATEMENT", bold: true, size: 24 }),
        new TextRun({ text: `   ${formatJobCode(statement.code)}`, size: 20, color: "6B7280" }),
      ],
    }),

    heading("1. Project Information", branding),
    ...fields([
      ["Production", statement.production],
      ["Company", statement.company],
      ["Dates", statement.dates],
      ["Venues", statement.venues],
      ["Production Manager", statement.productionManager],
    ]),

    heading("2. Description of Works", branding),
    body(statement.descriptionOfWorks),

    heading("3. Standards & Guidance", branding),
    ...statement.standards.map(bullet),

    heading("4. Personnel & Responsibilities", branding),
    ...statement.personnel.map((p) => bullet(`${p.role} — ${p.responsibility}`)),

    heading("5. Plant and Equipment", branding),
    ...statement.plantAndEquipment.map(bullet),

    heading("6. Method of Work", branding),
    ...statement.methodOfWork.map((s) => bullet(`${s.stage} — ${s.detail}`)),

    heading("7. Haze Effects (COSHH Controlled)", branding),
    ...statement.coshh.map(bullet),

    heading("8. Risk Control Measures", branding),
    ...statement.riskControls.map(bullet),

    heading("9. PPE Requirements", branding),
    ...statement.ppe.map(bullet),

    heading("10. Emergency Procedures", branding),
    ...statement.emergency.map(bullet),

    heading("11. Environmental Considerations", branding),
    ...statement.environmental.map(bullet),

    heading("12. Monitoring", branding),
    ...statement.monitoring.map(bullet),

    heading("13. Sign-Off", branding),
    ...signOff(statement),
  ];

  if (branding.registeredDetails) {
    children.push(
      new Paragraph({
        spacing: { before: 320 },
        children: [
          new TextRun({ text: branding.registeredDetails, size: 16, color: "6B7280" }),
        ],
      }),
    );
  }

  const document = new Document({
    creator: branding.companyName,
    title: `Method Statement ${formatJobCode(statement.code)}`,
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        headers: { default: brandedHeader(branding) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: footerText(branding, packVersion),
                    size: 16,
                    color: "6B7280",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

function fields(pairs: [string, string][]): Paragraph[] {
  return pairs.map(
    ([label, value]) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 20 }),
          new TextRun({ text: value || "TBC", size: 20 }),
        ],
      }),
  );
}

/** Signature blocks stay blank lines — these are signed by hand on site. */
function signOff(statement: MethodStatement): Paragraph[] {
  const line = "_".repeat(40);
  return [
    ...fields([["Prepared By", statement.preparedBy ?? line]]),
    ...fields([["Date", line]]),
    ...fields([["Approved By", statement.approvedBy ?? line]]),
    ...fields([["Date", line]]),
  ];
}
