import {
  AlignmentType,
  Document,
  Footer,
  Header,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IImageOptions,
} from "docx";
import type { Branding } from "@/domain/branding";
import { ooxmlColour } from "@/domain/branding";
import type { RiskBand } from "@/domain/risk";

/** Band shading. Muted enough to photocopy and print legibly in mono. */
export const BAND_FILL: Record<RiskBand, string> = {
  LOW: "D6E8D5",
  MEDIUM: "FBE7C6",
  HIGH: "F6CBA6",
  CRITICAL: "E9A8A8",
};

/**
 * Document header carrying the company logo.
 *
 * Falls back to the company name set large, so a workspace with no logo still
 * produces something that looks deliberate rather than unbranded.
 */
export function brandedHeader(branding: Branding): Header {
  const children: Paragraph[] = [];

  if (branding.logo && branding.logo.mimeType !== "image/svg+xml") {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            data: Buffer.from(branding.logo.data, "base64"),
            transformation: fitLogo(branding.logo.widthPx, branding.logo.heightPx),
            type: branding.logo.mimeType === "image/png" ? "png" : "jpg",
          } as IImageOptions),
        ],
      }),
    );
  } else {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: branding.companyName.toUpperCase(),
            bold: true,
            size: 28,
            color: ooxmlColour(branding.theme.primary),
          }),
        ],
      }),
    );
  }

  return new Header({ children });
}

/**
 * Word measures images in points, and a logo dropped in at its native pixel
 * size will happily run off the page. Scale to fit a header band, preserving
 * aspect ratio.
 */
export function fitLogo(
  widthPx: number,
  heightPx: number,
  maxWidth = 180,
  maxHeight = 60,
): { width: number; height: number } {
  if (widthPx <= 0 || heightPx <= 0) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / widthPx, maxHeight / heightPx, 1);
  return {
    width: Math.round(widthPx * scale),
    height: Math.round(heightPx * scale),
  };
}

export function heading(text: string, branding: Branding, size = 26): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size,
        color: ooxmlColour(branding.theme.primary),
      }),
    ],
  });
}

export function body(text: string, opts: { bold?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? 20 })],
  });
}

export function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20 })],
  });
}

/** Footer line printed on every generated document. */
export function footerText(branding: Branding, packVersion: string): string {
  return branding.documentFooter?.trim()
    ? branding.documentFooter
    : `${branding.companyName} — ${packVersion}`;
}

/* ---------------------------------------------------------------------------
 * Table builders
 *
 * Every document below the RAMS pair is some arrangement of two shapes: a
 * two-column block of labelled facts, and a grid of rows. Building them here
 * keeps ten generators consistent, so a procurement schedule and a licence
 * register look like they came from the same company.
 * ------------------------------------------------------------------------ */

/** A two-column block of labelled facts. */
export function factTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { fill: "F3F4F6" },
              children: [body(label, { bold: true })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              children: [body(value || "—")],
            }),
          ],
        }),
    ),
  });
}

export interface GridColumn {
  header: string;
  /** Percentage width. Columns should sum to 100. */
  width: number;
}

/**
 * A grid with a header row.
 *
 * `rows` may contain plain strings or pre-built cells, so a generator can
 * shade a single cell (a risk band, an expired certificate) without needing
 * its own table builder.
 */
export function gridTable(
  columns: GridColumn[],
  rows: (string | TableCell)[][],
  options: { emptyMessage?: string } = {},
): Table {
  const header = new TableRow({
    tableHeader: true,
    children: columns.map(
      (column) =>
        new TableCell({
          width: { size: column.width, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
          verticalAlign: VerticalAlign.CENTER,
          children: [body(column.header, { bold: true })],
        }),
    ),
  });

  // A grid with no rows renders as a lone header, which reads like a bug. Say
  // plainly that there is nothing yet — on a licence register or a PO log,
  // "nothing here" is itself information the reader needs.
  const dataRows = rows.length
    ? rows.map(
        (row) =>
          new TableRow({
            children: row.map((cell) =>
              typeof cell === "string"
                ? new TableCell({ children: [body(cell)] })
                : cell,
            ),
          }),
      )
    : [
        new TableRow({
          children: [
            new TableCell({
              columnSpan: columns.length,
              children: [
                body(options.emptyMessage ?? "Nothing recorded at time of issue.", {
                  bold: false,
                }),
              ],
            }),
          ],
        }),
      ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
  });
}

/** A shaded cell, for a risk band or an expiry warning. */
export function shadedCell(text: string, fill: string): TableCell {
  return new TableCell({
    shading: { fill },
    verticalAlign: VerticalAlign.CENTER,
    children: [body(text, { bold: true })],
  });
}

/** Ruled lines people sign by hand on site. */
export function signatureRows(
  roles: string[],
  columns = ["Name", "Signature", "Date"],
): Table {
  return gridTable(
    [{ header: "Role", width: 28 }, ...columns.map((header) => ({ header, width: 24 }))],
    roles.map((role) => [role, "", "", ""]),
  );
}

/** Blank rows for a form people fill in on paper. */
export function blankRows(count: number, columns: number): string[][] {
  return Array.from({ length: count }, () => Array.from({ length: columns }, () => ""));
}

/**
 * Standard document skeleton.
 *
 * Every generated document gets the company header, the footer line, and the
 * same page margins, so a pack printed together looks like one pack.
 */
export function buildDocument(options: {
  branding: Branding;
  title: string;
  packVersion: string;
  children: (Paragraph | Table)[];
  margins?: { top: number; bottom: number; left: number; right: number };
}): Document {
  const { branding, title, packVersion, children } = options;
  const margin = options.margins ?? { top: 720, bottom: 720, left: 780, right: 780 };

  return new Document({
    creator: branding.companyName,
    title,
    sections: [
      {
        properties: { page: { margin } },
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
}

/** Document title block: the name of the document and its job code. */
export function titleBlock(
  title: string,
  code: string,
  branding: Branding,
  subtitle?: string,
): Paragraph[] {
  const block = [
    new Paragraph({
      spacing: { after: subtitle ? 40 : 160 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 30,
          color: ooxmlColour(branding.theme.primary),
        }),
        new TextRun({ text: `   ${code}`, size: 20, color: "6B7280" }),
      ],
    }),
  ];

  if (subtitle) {
    block.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [new TextRun({ text: subtitle, size: 20, color: "6B7280" })],
      }),
    );
  }
  return block;
}
