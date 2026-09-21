import { Packer, Paragraph, Table } from "docx";
import type { Branding } from "@/domain/branding";
import { formatJobCode, type JobCode } from "@/domain/job-code";
import type { CallSheet, ProductionSchedule } from "@/domain/documents";
import type { Project } from "@/domain/types";
import {
  blankRows,
  body,
  buildDocument,
  factTable,
  gridTable,
  heading,
  titleBlock,
} from "./shared";

/** Production schedule: phases, owners and milestones. */
export async function renderProductionSchedule(
  schedule: ProductionSchedule,
  project: Project,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock("Production Schedule", formatJobCode(code), branding, project.name),

    factTable([
      ["Production", project.name],
      ["Client", project.client],
      ["Production manager", project.productionManager],
      ["Venues", project.venues.join(", ")],
      [
        "Dates",
        [project.startDate, project.endDate].filter(Boolean).join(" to ") || "To be confirmed",
      ],
    ]),

    heading("Phases", branding),
    gridTable(
      [
        { header: "Phase", width: 28 },
        { header: "Start", width: 14 },
        { header: "End", width: 14 },
        { header: "Owner", width: 20 },
        { header: "Notes", width: 24 },
      ],
      schedule.phases.map((phase) => [
        phase.name,
        phase.start,
        phase.end,
        phase.owner,
        phase.notes ?? "",
      ]),
      { emptyMessage: "No phases scheduled yet." },
    ),

    heading("Milestones", branding),
    gridTable(
      [
        { header: "Milestone", width: 50 },
        { header: "Date", width: 25 },
        { header: "Owner", width: 25 },
      ],
      schedule.milestones.map((m) => [m.name, m.date, m.owner]),
      { emptyMessage: "No milestones set." },
    ),

    heading("Distribution", branding),
    body(
      "Issued to production crew, technical department, venue management and the client. Supersedes any previously issued schedule for this production.",
    ),
  ];

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Production Schedule ${formatJobCode(code)}`,
      children,
    }),
  );
}

/**
 * Daily call sheet.
 *
 * The one document on site that people actually read, so it leads with times
 * and ends with who to ring when something goes wrong.
 */
export async function renderCallSheet(
  sheet: CallSheet,
  project: Project,
  code: JobCode,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...titleBlock(
      "Call Sheet",
      formatJobCode(code),
      branding,
      `${project.name} — ${sheet.date || "date to be confirmed"}`,
    ),

    factTable([
      ["Date", sheet.date],
      ["Venue", sheet.venue],
      ["Address", sheet.address],
    ]),

    heading("Calls", branding),
    gridTable(
      [
        { header: "Time", width: 16 },
        { header: "Activity", width: 54 },
        { header: "Who", width: 30 },
      ],
      sheet.calls.map((call) => [call.time, call.activity, call.who]),
      { emptyMessage: "No calls set for this day." },
    ),

    heading("Key contacts", branding),
    gridTable(
      [
        { header: "Role", width: 34 },
        { header: "Name", width: 33 },
        { header: "Phone", width: 33 },
      ],
      sheet.contacts.map((contact) => [contact.role, contact.name, contact.phone]),
      { emptyMessage: "Contacts to be confirmed before issue." },
    ),

    heading("Emergency", branding),
    gridTable(
      [
        { header: "", width: 34 },
        { header: "Detail", width: 66 },
      ],
      sheet.emergency.map((entry) => [entry.label, entry.detail]),
      { emptyMessage: "Complete before issue: assembly point, first aider, nearest A&E." },
    ),
  ];

  if (sheet.notes) {
    children.push(heading("Notes", branding), body(sheet.notes));
  }

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Call Sheet ${formatJobCode(code)}`,
      children,
    }),
  );
}

/** A call sheet skeleton, with the emergency lines a site needs. */
export function baseCallSheet(project: Project): CallSheet {
  return {
    date: project.startDate ?? "",
    venue: project.venues[0] ?? "",
    address: "",
    calls: [
      { time: "07:00", activity: "Crew call, induction and briefing", who: "All crew" },
      { time: "07:30", activity: "Vehicles arrive, load-in begins", who: "Crew, drivers" },
      { time: "12:00", activity: "Break", who: "All" },
      { time: "13:00", activity: "Installation continues", who: "Technical" },
      { time: "17:00", activity: "Testing and focus", who: "Technical" },
    ],
    contacts: [
      { role: "Production Manager", name: project.productionManager, phone: "" },
      { role: "Technical Manager", name: "", phone: "" },
      { role: "Stage Manager", name: "", phone: "" },
      { role: "Venue duty manager", name: "", phone: "" },
    ],
    emergency: [
      { label: "Assembly point", detail: "" },
      { label: "First aider on site", detail: "" },
      { label: "Nearest A&E", detail: "" },
      { label: "Venue emergency number", detail: "" },
    ],
  };
}

/** Blank rows a printed call sheet needs for people who turn up unlisted. */
export const CALL_SHEET_SPARE_ROWS = blankRows(3, 3);
