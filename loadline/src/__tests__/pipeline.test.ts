import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@/store/local";
import { renderRiskAssessment } from "@/documents/risk-assessment";
import { renderMethodStatement } from "@/documents/method-statement";
import { methodStatementFor } from "@/domain/method-statement-template";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { formatJobCode } from "@/domain/job-code";
import type { RiskAssessment } from "@/domain/types";

/**
 * End to end: a workspace is created, a code is issued, a project is made, and
 * the documents that land in its folder are opened back up and read.
 *
 * A .docx is a zip, so asserting on file size proves nothing. These tests
 * unzip the result and read the actual document text.
 */

let root: string;
let store: LocalStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "loadline-e2e-"));
  store = new LocalStore(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function documentText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  // Strip tags so assertions read against visible text, not markup, then
  // decode the entities OOXML escapes ("&amp;" for the ampersand in
  // "Loading & Unloading"), so tests assert on what a reader sees.
  return decodeEntities(xml.replace(/<[^>]+>/g, ""));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function headerXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const name = Object.keys(zip.files).find((f) => /word\/header\d*\.xml/.test(f));
  return name ? zip.file(name)!.async("string") : "";
}

describe("issue a project and generate its RAMS pack", () => {
  it("carries the issued job code into the document body", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const { code, workspace: updated } = await store.issueCode(workspace, "PROD", 2026);
    const project = await store.createProject(updated, {
      code,
      name: "Winter Gala",
      client: "Northern Arts Trust",
      company: updated.companyName,
      productionManager: "A. Reed",
      status: "confirmed",
      venues: ["Leeds Playhouse"],
      startDate: "2026-11-02",
      endDate: "2026-11-14",
    });

    const assessment: RiskAssessment = {
      code: project.code,
      projectId: project.id,
      circulation: updated.defaultCirculation,
      activities: HAZARD_LIBRARY,
      assessedBy: project.productionManager,
      assessedOn: "2026-09-21",
      reviewTrigger: "In event of Accident or Near Miss",
      packVersion: updated.packVersion,
    };

    const buffer = await renderRiskAssessment(assessment, updated.branding);
    const text = await documentText(buffer);

    expect(text).toContain(`RISK ASSESSMENT NUMBER ${formatJobCode(code)}`);
    expect(formatJobCode(code)).toBe("PROD2026-001a");

    // The stale-code defect in the source pack must not reappear: the only
    // job code anywhere in the document is this document's own.
    const codes = [...new Set(text.match(/[A-Z]{2,6}\d{4}-\d{3}[a-z]/g) ?? [])];
    expect(codes).toEqual(["PROD2026-001a"]);
  });

  it("writes the hazards, persons at risk and every control measure", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const { code, workspace: updated } = await store.issueCode(workspace, "PROD", 2026);

    const buffer = await renderRiskAssessment(
      {
        code,
        projectId: "x",
        circulation: updated.defaultCirculation,
        activities: HAZARD_LIBRARY,
        assessedBy: "Jake Johnson",
        assessedOn: "2026-09-21",
        reviewTrigger: "In event of Accident or Near Miss",
        packVersion: updated.packVersion,
      },
      updated.branding,
    );
    const text = await documentText(buffer);

    expect(text).toContain("Loading & Unloading of Equipment");
    expect(text).toContain("Musculoskeletal");
    expect(text).toContain("Production Crew");
    expect(text).toContain("Venue Management");

    // Every control measure from the library reaches the page.
    for (const control of HAZARD_LIBRARY.flatMap((a) => a.hazards).flatMap((h) => h.controls)) {
      expect(text, control.id).toContain(control.text.slice(0, 40));
    }
  });

  it("prints the ratings and bands from the source assessment", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const { code, workspace: updated } = await store.issueCode(workspace, "PROD", 2026);
    const buffer = await renderRiskAssessment(
      {
        code,
        projectId: "x",
        circulation: [],
        activities: HAZARD_LIBRARY,
        assessedBy: "Jake Johnson",
        assessedOn: "2026-09-21",
        reviewTrigger: "In event of Accident or Near Miss",
        packVersion: updated.packVersion,
      },
      updated.branding,
    );
    const text = await documentText(buffer);

    expect(text).toContain("Rating 15");
    expect(text).toContain("Rating 10");
    expect(text).toContain("HIGH");
    expect(text).toContain("LOW");
  });

  it("brands the header with the company name when no logo is set", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const statement = methodStatementFor(
      {
        id: "PROD2026-001a",
        code: (await store.issueCode(workspace, "PROD", 2026)).code,
        name: "Winter Gala",
        client: "Northern Arts Trust",
        company: "Sculptivate",
        productionManager: "A. Reed",
        status: "confirmed",
        venues: ["Leeds Playhouse"],
      },
      (await store.issueCode(await store.ensureWorkspace("Sculptivate"), "PROD", 2026)).code,
    );

    const buffer = await renderMethodStatement(
      statement,
      workspace.branding,
      workspace.packVersion,
    );
    expect(await headerXml(buffer)).toContain("SCULPTIVATE");
  });

  it("embeds an uploaded logo into the document header", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const branding = {
      ...workspace.branding,
      logo: {
        filename: "logo.png",
        mimeType: "image/png",
        data: ONE_PIXEL_PNG,
        widthPx: 1,
        heightPx: 1,
      },
    };

    const buffer = await renderRiskAssessment(
      {
        code: (await store.issueCode(workspace, "PROD", 2026)).code,
        projectId: "x",
        circulation: [],
        activities: [],
        assessedBy: "Jake Johnson",
        assessedOn: "2026-09-21",
        reviewTrigger: "In event of Accident or Near Miss",
        packVersion: workspace.packVersion,
      },
      branding,
    );

    const zip = await JSZip.loadAsync(buffer);
    const media = Object.keys(zip.files).filter((f) => f.startsWith("word/media/"));
    expect(media.length).toBeGreaterThan(0);
    expect(await headerXml(buffer)).toContain("<w:drawing>");
  });

  it("lands both documents in the project's RAMS folder", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const { code, workspace: updated } = await store.issueCode(workspace, "PROD", 2026);
    const project = await store.createProject(updated, {
      code,
      name: "Winter Gala",
      client: "",
      company: "Sculptivate",
      productionManager: "A. Reed",
      status: "confirmed",
      venues: [],
    });

    const rams = await renderRiskAssessment(
      {
        code,
        projectId: project.id,
        circulation: [],
        activities: HAZARD_LIBRARY,
        assessedBy: "A. Reed",
        assessedOn: "2026-09-21",
        reviewTrigger: "In event of Accident or Near Miss",
        packVersion: updated.packVersion,
      },
      updated.branding,
    );
    const method = await renderMethodStatement(
      methodStatementFor(project, code),
      updated.branding,
      updated.packVersion,
    );

    await store.putDocument(project, "01 RAMS", `Risk Assessment ${project.id}.docx`, rams);
    await store.putDocument(project, "01 RAMS", `Method Statement ${project.id}.docx`, method);

    const documents = await store.listDocuments(project, "01 RAMS");
    expect(documents.map((d) => d.name).sort()).toEqual([
      "Method Statement PROD2026-001a.docx",
      "Risk Assessment PROD2026-001a.docx",
    ]);

    // And the bytes on disk are a real docx, not a truncated write.
    const written = await fs.readFile(documents[0].id);
    expect((await documentText(written)).length).toBeGreaterThan(100);
  });
});

/** Smallest valid PNG, for exercising the image embedding path. */
const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
