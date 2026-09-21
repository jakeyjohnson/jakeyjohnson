import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { Activity, Hazard, RiskAssessment } from "@/domain/types";
import type { Branding } from "@/domain/branding";
import { ooxmlColour } from "@/domain/branding";
import { LIKELIHOOD_SCALE, SEVERITY_SCALE, score } from "@/domain/risk";
import { formatJobCode } from "@/domain/job-code";
import { BAND_FILL, body, brandedHeader, footerText, heading } from "./shared";

/**
 * Renders a risk assessment as .docx, following the layout of the existing
 * Mega Events pack: a circulation list, then one hazard table per activity,
 * then the scoring legend and sign-off.
 *
 * The one deliberate departure is that controls are listed as separate
 * bullets rather than run together in a single cell. The source documents put
 * four distinct control measures in one paragraph, which is why crews skim
 * them.
 */
export async function renderRiskAssessment(
  assessment: RiskAssessment,
  branding: Branding,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: `RISK ASSESSMENT NUMBER ${formatJobCode(assessment.code)}`,
          bold: true,
          size: 28,
          color: ooxmlColour(branding.theme.primary),
        }),
      ],
    }),
    body("This Assessment should be circulated to:", { bold: true }),
    body(assessment.circulation.join(", ")),
  ];

  for (const activity of assessment.activities) {
    children.push(heading(activity.name, branding));
    children.push(activityTable(activity));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    children.push(hazardTable(activity.hazards));
  }

  children.push(heading("Scoring", branding));
  children.push(legendTable());
  children.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
  children.push(signOffTable(assessment));

  const document = new Document({
    creator: branding.companyName,
    title: `Risk Assessment ${formatJobCode(assessment.code)}`,
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: { default: brandedHeader(branding) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: footerText(branding, assessment.packVersion),
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

function activityTable(activity: Activity): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      labelledRow("Activity", activity.name),
      labelledRow("Description of Activity", activity.description),
    ],
  });
}

function labelledRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { fill: "F3F4F6" },
        children: [body(label, { bold: true })],
      }),
      new TableCell({
        width: { size: 75, type: WidthType.PERCENTAGE },
        children: [body(value)],
      }),
    ],
  });
}

const HAZARD_COLUMNS = [
  "Hazards & Potential Harm from Activity",
  "Persons at Risk",
  "Risk Before Controls",
  "Existing & Additional Controls to Reduce Risk",
  "Residual Risk after Controls",
];

function hazardTable(hazards: Hazard[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: HAZARD_COLUMNS.map(
      (text, i) =>
        new TableCell({
          width: { size: [30, 12, 12, 34, 12][i], type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
          verticalAlign: VerticalAlign.CENTER,
          children: [body(text, { bold: true })],
        }),
    ),
  });

  const rows = hazards.map((hazard) => {
    const before = score(hazard.before.likelihood, hazard.before.severity);
    const after = score(hazard.after.likelihood, hazard.after.severity);

    return new TableRow({
      children: [
        new TableCell({ children: [body(hazard.description)] }),
        new TableCell({
          children: hazard.personsAtRisk.map((p) => body(p)),
        }),
        riskCell(before.likelihood, before.severity, before.rating, before.band),
        new TableCell({
          children: hazard.controls.map((control) =>
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [
                new TextRun({ text: control.text, size: 18 }),
                ...(control.basis
                  ? [new TextRun({ text: ` (${control.basis})`, size: 16, italics: true, color: "6B7280" })]
                  : []),
              ],
            }),
          ),
        }),
        riskCell(after.likelihood, after.severity, after.rating, after.band),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function riskCell(
  likelihood: number,
  severity: number,
  rating: number,
  band: string,
): TableCell {
  return new TableCell({
    shading: { fill: BAND_FILL[band as keyof typeof BAND_FILL] },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      body(`Likelihood ${likelihood}`),
      body(`Severity ${severity}`),
      body(`Rating ${rating}`, { bold: true }),
      body(band, { bold: true }),
    ],
  });
}

/**
 * The 5x5 matrix printed at the foot of every assessment in the source pack,
 * reproduced so a reader can check the arithmetic without another document.
 */
function legendTable(): Table {
  const likelihoods = [1, 2, 3, 4, 5] as const;
  const severities = [1, 2, 3, 4, 5] as const;

  const header = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: { fill: "E5E7EB" },
        children: [body("Risk Rating = Likelihood x Severity", { bold: true })],
      }),
      ...likelihoods.map(
        (l) =>
          new TableCell({
            shading: { fill: "E5E7EB" },
            children: [body(`${l}: ${LIKELIHOOD_SCALE[l]}`, { bold: true })],
          }),
      ),
    ],
  });

  const rows = severities.map(
    (s) =>
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F3F4F6" },
            children: [body(`${s}: ${SEVERITY_SCALE[s]}`, { bold: true })],
          }),
          ...likelihoods.map((l) => {
            const cell = score(l, s);
            return new TableCell({
              shading: { fill: BAND_FILL[cell.band] },
              verticalAlign: VerticalAlign.CENTER,
              children: [body(String(cell.rating), { bold: true })],
            });
          }),
        ],
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function signOffTable(assessment: RiskAssessment): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      labelledRow("Assessed By", assessment.assessedBy),
      labelledRow("Date", assessment.assessedOn),
      labelledRow("Review Assessment", assessment.reviewTrigger),
    ],
  });
}
