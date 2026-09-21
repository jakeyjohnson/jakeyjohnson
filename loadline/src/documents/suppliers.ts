import { Packer, Paragraph, Table } from "docx";
import type { Branding } from "@/domain/branding";
import { formatJobCode, type JobCode } from "@/domain/job-code";
import type {
  Licence,
  SubcontractorQuestionnaire,
  Supplier,
} from "@/domain/documents";
import { expiryState } from "@/domain/documents";
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
  titleBlock,
} from "./shared";

const EXPIRY_FILL = {
  ok: BAND_FILL.LOW,
  expiring: BAND_FILL.MEDIUM,
  expired: BAND_FILL.CRITICAL,
  unknown: "E5E7EB",
} as const;

const EXPIRY_LABEL = {
  ok: "In date",
  expiring: "Expiring",
  expired: "EXPIRED",
  unknown: "Not held",
} as const;

/**
 * Approved supplier register.
 *
 * Insurance expiry is the column that matters: a supplier whose public
 * liability lapses mid-build is a problem discovered on site, far too late.
 * It is a date comparison, so the document does it rather than a person.
 */
export async function renderSupplierRegister(
  suppliers: Supplier[],
  code: JobCode,
  branding: Branding,
  packVersion: string,
  asOf: Date = new Date(),
): Promise<Buffer> {
  const problems = suppliers.filter((supplier) => {
    const state = expiryState(supplier.insuranceExpiry, asOf);
    return state === "expired" || state === "expiring" || state === "unknown";
  });

  const children: (Paragraph | Table)[] = [
    ...titleBlock(
      "Approved Supplier Register",
      formatJobCode(code),
      branding,
      `${suppliers.filter((s) => s.approved).length} approved of ${suppliers.length} listed`,
    ),

    heading("Suppliers", branding),
    gridTable(
      [
        { header: "Supplier", width: 22 },
        { header: "Category", width: 14 },
        { header: "Contact", width: 22 },
        { header: "Insured to", width: 12 },
        { header: "Expiry", width: 14 },
        { header: "Status", width: 16 },
      ],
      suppliers.map((supplier) => {
        const state = expiryState(supplier.insuranceExpiry, asOf);
        return [
          supplier.name,
          supplier.category,
          [supplier.contact, supplier.phone, supplier.email].filter(Boolean).join(" · "),
          supplier.insuredTo ?? "—",
          shadedCell(supplier.insuranceExpiry ?? "—", EXPIRY_FILL[state]),
          supplier.approved
            ? shadedCell("Approved", BAND_FILL.LOW)
            : shadedCell("Not approved", BAND_FILL.MEDIUM),
        ];
      }),
      {
        emptyMessage:
          "No suppliers on the register. Add suppliers as their questionnaires and insurance certificates are returned.",
      },
    ),
  ];

  if (problems.length > 0) {
    children.push(
      heading("Attention", branding),
      body(
        "The following need checking before work is placed with them. A lapsed or unevidenced public liability policy is a reason to stop, not a formality:",
        { bold: true },
      ),
      ...problems.map((supplier) =>
        bullet(
          `${supplier.name} — ${EXPIRY_LABEL[expiryState(supplier.insuranceExpiry, asOf)]}${
            supplier.insuranceExpiry ? ` (${supplier.insuranceExpiry})` : ""
          }`,
        ),
      ),
    );
  }

  children.push(
    heading("Accreditations held", branding),
    gridTable(
      [
        { header: "Supplier", width: 34 },
        { header: "Accreditations", width: 66 },
      ],
      suppliers.map((supplier) => [
        supplier.name,
        supplier.accreditations.join(", ") || "None recorded",
      ]),
      { emptyMessage: "None recorded." },
    ),

    heading("Approval", branding),
    body(
      "A supplier is approved once their questionnaire is returned, their insurance certificates are current and on file, and any accreditation claimed has been verified. Approval lapses when insurance expires.",
    ),
  );

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Supplier Register ${formatJobCode(code)}`,
      children,
    }),
  );
}

/** Licence and permissions register. */
export async function renderLicenceRegister(
  licences: Licence[],
  code: JobCode,
  branding: Branding,
  packVersion: string,
  asOf: Date = new Date(),
): Promise<Buffer> {
  const outstanding = licences.filter(
    (licence) => licence.status === "not-started" || licence.status === "applied",
  );

  const children: (Paragraph | Table)[] = [
    ...titleBlock(
      "Licence & Permissions Register",
      formatJobCode(code),
      branding,
      `${outstanding.length} of ${licences.length} outstanding`,
    ),

    heading("Register", branding),
    gridTable(
      [
        { header: "Licence or permission", width: 26 },
        { header: "Authority", width: 20 },
        { header: "Reference", width: 14 },
        { header: "Expires", width: 14 },
        { header: "Owner", width: 12 },
        { header: "Status", width: 14 },
      ],
      licences.map((licence) => {
        const state = expiryState(licence.expiresOn, asOf);
        return [
          licence.name,
          licence.authority,
          licence.reference || "—",
          licence.expiresOn
            ? shadedCell(licence.expiresOn, EXPIRY_FILL[state])
            : "—",
          licence.owner,
          licence.status === "granted"
            ? shadedCell("Granted", BAND_FILL.LOW)
            : licence.status === "refused" || licence.status === "expired"
              ? shadedCell(licence.status, BAND_FILL.CRITICAL)
              : shadedCell(licence.status, BAND_FILL.MEDIUM),
        ];
      }),
      { emptyMessage: "No licences recorded." },
    ),

    heading("Notes", branding),
    gridTable(
      [
        { header: "Licence or permission", width: 30 },
        { header: "Notes", width: 70 },
      ],
      licences.filter((l) => l.notes).map((l) => [l.name, l.notes!]),
      { emptyMessage: "None." },
    ),

    heading("Applicability", branding),
    body(
      "Not every entry applies to every job. Mark those that do not apply and say why, rather than deleting them, so the reasoning survives to the next production. Several carry statutory notice periods, so work through this register at the start of a job, not the week before.",
    ),
  ];

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Licence Register ${formatJobCode(code)}`,
      children,
    }),
  );
}

/** Subcontractor pre-qualification questionnaire, issued blank for return. */
export async function renderSubcontractorQuestionnaire(
  questionnaire: SubcontractorQuestionnaire,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock(
      "Subcontractor Questionnaire",
      formatJobCode(code),
      branding,
      "Complete and return with copies of your current insurance certificates.",
    ),

    body(
      `${branding.companyName} uses this questionnaire to satisfy itself that subcontractors are competent and adequately insured. We cannot place work with you until it is returned and your certificates are on file.`,
    ),
  ];

  for (const section of questionnaire.sections) {
    children.push(heading(section.heading, branding));
    children.push(
      gridTable(
        [
          { header: "Question", width: 46 },
          { header: "Answer", width: 54 },
        ],
        section.questions.map((question) => [question, ""]),
      ),
    );
  }

  children.push(
    heading("Return", branding),
    factTable([
      ["Completed by", ""],
      ["Position", ""],
      ["Signature", ""],
      ["Date", ""],
    ]),
    body(
      "Attach: employers' liability certificate, public liability certificate, health and safety policy where you employ five or more people, and relevant training records.",
    ),
  );

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Subcontractor Questionnaire ${formatJobCode(code)}`,
      children,
    }),
  );
}

/** Spare rows for a register printed and filled in by hand. */
export const REGISTER_SPARE_ROWS = blankRows(5, 6);
