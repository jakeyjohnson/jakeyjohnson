import {
  AlignmentType,
  Header,
  ImageRun,
  Paragraph,
  TextRun,
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
