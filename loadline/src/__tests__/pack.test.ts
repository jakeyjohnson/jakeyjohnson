import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@/store/local";
import { generatePack, PACK, baseProductionSchedule } from "@/documents/pack";
import { PLACEHOLDER } from "@/domain/document-defaults";
import type { Project, Workspace } from "@/domain/types";
import { requireJobCode } from "@/domain/job-code";

let root: string;
let store: LocalStore;
let workspace: Workspace;
let project: Project;

const ASOF = new Date("2026-09-21");

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "loadline-pack-"));
  store = new LocalStore(root);
  workspace = await store.ensureWorkspace("Sculptivate");
  project = await store.createProject(workspace, {
    code: requireJobCode("PROD2026-001a"),
    name: "Winter Gala",
    client: "Northern Arts Trust",
    company: "Sculptivate",
    productionManager: "A. Reed",
    status: "confirmed",
    venues: ["Leeds Playhouse"],
    startDate: "2026-11-02",
    endDate: "2026-11-14",
  });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function textOf(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file("word/document.xml")!.async("string"))
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("the base pack", () => {
  it("produces every document the pack defines", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    expect(documents).toHaveLength(PACK.length);
    expect(documents.map((d) => d.kind)).toEqual(PACK.map((d) => d.kind));
  });

  it("produces a valid, non-trivial docx for each", async () => {
    for (const document of await generatePack(project, workspace, { asOf: ASOF })) {
      expect(document.contents[0], document.kind).toBe(0x50); // "PK"
      const text = await textOf(document.contents);
      expect(text.length, document.kind).toBeGreaterThan(200);
    }
  });

  it("stamps every document with the project's job code and nothing else", async () => {
    for (const document of await generatePack(project, workspace, { asOf: ASOF })) {
      const text = await textOf(document.contents);
      expect(text, document.kind).toContain("PROD2026-001a");
      const codes = [...new Set(text.match(/[A-Z]{2,6}\d{4}-\d{3}[a-z]/g) ?? [])];
      expect(codes, document.kind).toEqual(["PROD2026-001a"]);
    }
  });

  it("files each document into the right folder", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    for (const document of documents) {
      await store.putDocument(project, document.section, document.filename, document.contents);
    }

    const rams = await store.listDocuments(project, "01 RAMS");
    expect(rams.map((d) => d.name).sort()).toEqual([
      "Accident & Near Miss Report PROD2026-001a.docx",
      "COSHH Assessment PROD2026-001a.docx",
      "Lifting Plan PROD2026-001a.docx",
      "Method Statement PROD2026-001a.docx",
      "Risk Assessment PROD2026-001a.docx",
      "Site Induction Record PROD2026-001a.docx",
    ]);

    expect((await store.listDocuments(project, "02 Procurement")).length).toBe(2);
    expect((await store.listDocuments(project, "03 Schedule")).length).toBe(2);
    expect((await store.listDocuments(project, "04 Licences")).length).toBe(1);
    expect((await store.listDocuments(project, "05 Suppliers")).length).toBe(2);
  });

  it("marks documents needing completion, and only those", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const flagged = documents.filter((d) => d.needsCompletion).map((d) => d.kind);
    expect(flagged).toContain("coshh-assessment");
    expect(flagged).toContain("lifting-plan");
    expect(flagged).not.toContain("risk-assessment");
    expect(flagged).not.toContain("accident-report");
  });

  it("marks a placeholder visibly rather than inventing safety data", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const coshh = documents.find((d) => d.kind === "coshh-assessment")!;
    const text = await textOf(coshh.contents);
    // Hazard statements must come from the real safety data sheet.
    expect(text).toContain(PLACEHOLDER);
    expect(text).toContain("safety data sheet");
  });
});

describe("document content", () => {
  it("writes a COSHH assessment covering the haze the method statement promises", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "coshh-assessment")!.contents);
    expect(text).toContain("Water-based haze fluid");
    expect(text).toContain("Inhalation");
    expect(text).toContain("Fire detection isolated only with the venue's written approval");
  });

  it("names an appointed person on the lifting plan, as LOLER requires", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "lifting-plan")!.contents);
    expect(text).toContain("Appointed person");
    expect(text).toContain("A. Reed");
    // No loads entered yet, so it must say so rather than showing an empty grid.
    expect(text).toContain("No loads entered");
  });

  it("includes stop-work authority in the induction", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "site-induction")!.contents);
    expect(text).toContain("Stop work authority");
    expect(text).toContain("without consequence");
  });

  it("asks the RIDDOR question on the accident form", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "accident-report")!.contents);
    expect(text).toContain("RIDDOR");
    expect(text).toContain("near miss");
  });

  it("computes order-by dates on the procurement schedule", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "procurement-schedule")!.contents);
    expect(text).toContain("Order by");
    // 10 working days back from 2026-11-02 is 2026-10-19.
    expect(text).toContain("2026-10-19");
  });

  it("shows computed purchase order totals and demands the PO number on invoices", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "purchase-order")!.contents);
    expect(text).toContain("VAT @ 20%");
    expect(text).toContain("Quote purchase order number PROD2026-001a");
  });

  it("lists licences with statutory notice periods flagged", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "licence-register")!.contents);
    expect(text).toContain("Child performance licence");
    expect(text).toContain("Road closure or highway licence");
    expect(text).toContain("Fire detection isolation permit");
  });

  it("asks subcontractors for insurance and accident history", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(
      documents.find((d) => d.kind === "subcontractor-questionnaire")!.contents,
    );
    expect(text).toContain("Employers' liability insurer");
    expect(text).toContain("RIDDOR reportable incidents in the last three years");
  });

  it("says plainly when the supplier register is empty", async () => {
    const documents = await generatePack(project, workspace, { asOf: ASOF });
    const text = await textOf(documents.find((d) => d.kind === "supplier-register")!.contents);
    expect(text).toContain("No suppliers on the register");
  });
});

describe("schedule derivation", () => {
  it("spreads phases across the project's dates", () => {
    const schedule = baseProductionSchedule(project);
    expect(schedule.phases).toHaveLength(11);
    expect(schedule.phases[0].start).toBe("2026-11-02");
    expect(schedule.phases[schedule.phases.length - 1].end).toBe("2026-11-14");
    expect(schedule.milestones.length).toBeGreaterThan(0);
  });

  it("leaves dates blank rather than inventing them when the project has none", () => {
    const schedule = baseProductionSchedule({
      ...project,
      startDate: undefined,
      endDate: undefined,
    });
    expect(schedule.phases.every((p) => p.start === "")).toBe(true);
    expect(schedule.milestones).toEqual([]);
  });

  it("copes with a single-day project", () => {
    const schedule = baseProductionSchedule({
      ...project,
      startDate: "2026-11-02",
      endDate: "2026-11-02",
    });
    expect(schedule.phases).toHaveLength(11);
    expect(schedule.phases[0].start).toBe("2026-11-02");
  });
});
