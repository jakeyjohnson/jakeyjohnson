import { describe, expect, it } from "vitest";
import { renderRiskAssessment } from "../risk-assessment";
import { renderMethodStatement } from "../method-statement";
import { fitLogo } from "../shared";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { defaultBranding } from "@/domain/branding";
import { methodStatementFor } from "@/domain/method-statement-template";
import { requireJobCode } from "@/domain/job-code";
import type { Project, RiskAssessment } from "@/domain/types";

const branding = defaultBranding("Sculptivate");
const code = requireJobCode("PROD2026-007a");

const project: Project = {
  id: "PROD2026-007a",
  code,
  name: "Winter Gala",
  client: "Northern Arts Trust",
  company: "Sculptivate",
  productionManager: "A. Reed",
  status: "confirmed",
  venues: ["Leeds Playhouse", "Sheffield Crucible"],
  startDate: "2026-11-02",
  endDate: "2026-11-14",
};

const assessment: RiskAssessment = {
  code,
  projectId: project.id,
  circulation: ["Venue Management", "Production Crew"],
  activities: HAZARD_LIBRARY,
  assessedBy: "Jake Johnson",
  assessedOn: "2026-09-21",
  reviewTrigger: "In event of Accident or Near Miss",
  packVersion: "General Risk Assessment Pack 2025 v1.1",
};

/** .docx is a zip; every valid one starts with the PK local file header. */
function isDocx(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

describe("risk assessment rendering", () => {
  it("produces a valid docx", async () => {
    const buffer = await renderRiskAssessment(assessment, branding);
    expect(isDocx(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it("renders every activity in the library without throwing", async () => {
    await expect(
      renderRiskAssessment({ ...assessment, activities: HAZARD_LIBRARY }, branding),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("survives an assessment with no activities yet", async () => {
    const buffer = await renderRiskAssessment({ ...assessment, activities: [] }, branding);
    expect(isDocx(buffer)).toBe(true);
  });

  it("does not break on a malformed brand colour", async () => {
    const broken = {
      ...branding,
      theme: { ...branding.theme, primary: "not-a-colour" },
    };
    const buffer = await renderRiskAssessment(assessment, broken);
    expect(isDocx(buffer)).toBe(true);
  });
});

describe("method statement rendering", () => {
  it("produces a valid docx from the base template", async () => {
    const statement = methodStatementFor(project, code);
    const buffer = await renderMethodStatement(statement, branding, "pack v1.1");
    expect(isDocx(buffer)).toBe(true);
  });

  it("injects project facts rather than carrying the template's own", async () => {
    const statement = methodStatementFor(project, code);
    expect(statement.production).toBe("Winter Gala");
    expect(statement.company).toBe("Sculptivate");
    expect(statement.venues).toBe("Leeds Playhouse, Sheffield Crucible");
    expect(statement.dates).toBe("2026-11-02 to 2026-11-14");
  });

  it("says TBC rather than inventing dates when none are set", () => {
    const statement = methodStatementFor({ ...project, startDate: undefined, endDate: undefined }, code);
    expect(statement.dates).toBe("TBC");
  });

  it("keeps all 13 sections' defaults populated", () => {
    const s = methodStatementFor(project, code);
    expect(s.standards).toContain("Health and Safety at Work etc. Act 1974");
    expect(s.methodOfWork).toHaveLength(6);
    expect(s.ppe.length).toBeGreaterThan(0);
  });
});

describe("logo fitting", () => {
  it("scales a wide logo down to the header band", () => {
    expect(fitLogo(1000, 200)).toEqual({ width: 180, height: 36 });
  });

  it("scales a tall logo by height", () => {
    expect(fitLogo(200, 400)).toEqual({ width: 30, height: 60 });
  });

  it("leaves a small logo alone rather than stretching it", () => {
    expect(fitLogo(100, 40)).toEqual({ width: 100, height: 40 });
  });

  it("falls back rather than dividing by zero on a broken image", () => {
    expect(fitLogo(0, 0)).toEqual({ width: 180, height: 60 });
  });
});
