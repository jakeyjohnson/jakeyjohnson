import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "../local";
import { formatJobCode, requireJobCode } from "@/domain/job-code";
import type { Project } from "@/domain/types";

let root: string;
let store: LocalStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "loadline-"));
  store = new LocalStore(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("workspace", () => {
  it("creates a workspace with default branding on first run", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    expect(workspace.companyName).toBe("Sculptivate");
    expect(workspace.branding.theme.primary).toMatch(/^#/);
    expect(workspace.seriesPrefixes).toContain("PROD");
  });

  it("reads back the same workspace rather than overwriting it", async () => {
    const first = await store.ensureWorkspace("Sculptivate");
    await store.saveWorkspace({
      ...first,
      branding: { ...first.branding, theme: { ...first.branding.theme, primary: "#ff0000" } },
    });
    const second = await store.ensureWorkspace("Ignored Name");
    expect(second.companyName).toBe("Sculptivate");
    expect(second.branding.theme.primary).toBe("#ff0000");
  });

  it("seeds the hazard library to disk", async () => {
    await store.ensureWorkspace("Sculptivate");
    const raw = await fs.readFile(path.join(root, "hazard-library.json"), "utf8");
    expect(JSON.parse(raw)[0].id).toBe("loading-unloading");
  });
});

describe("job code issuing", () => {
  it("hands out sequential codes and records them", async () => {
    let workspace = await store.ensureWorkspace("Sculptivate");
    const first = await store.issueCode(workspace, "PROD", 2026);
    const second = await store.issueCode(first.workspace, "PROD", 2026);
    expect(formatJobCode(first.code)).toBe("PROD2026-001a");
    expect(formatJobCode(second.code)).toBe("PROD2026-002a");

    workspace = await store.ensureWorkspace("Sculptivate");
    expect(workspace.issuedCodes).toHaveLength(2);
  });

  it("keeps series independent", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const prod = await store.issueCode(workspace, "PROD", 2026);
    const sm = await store.issueCode(prod.workspace, "SM", 2026);
    expect(formatJobCode(sm.code)).toBe("SM2026-001a");
  });

  it("refuses a series the workspace does not issue", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    await expect(store.issueCode(workspace, "NOPE", 2026)).rejects.toThrow(/not a series/);
  });
});

describe("projects", () => {
  async function seedProject(): Promise<Project> {
    const workspace = await store.ensureWorkspace("Sculptivate");
    return store.createProject(workspace, {
      code: requireJobCode("PROD2026-001a"),
      name: "Winter Gala",
      client: "Northern Arts Trust",
      company: "Sculptivate",
      productionManager: "A. Reed",
      status: "confirmed",
      venues: ["Leeds Playhouse"],
    });
  }

  it("creates the standard section folders", async () => {
    const project = await seedProject();
    const entries = await fs.readdir(project.folderId!);
    expect(entries).toContain("01 RAMS");
    expect(entries).toContain("04 Licences");
    expect(entries).toContain("project.json");
  });

  it("lists projects back", async () => {
    await seedProject();
    const workspace = await store.ensureWorkspace("Sculptivate");
    const projects = await store.listProjects(workspace);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Winter Gala");
    expect(projects[0].client).toBe("Northern Arts Trust");
  });

  it("surfaces a folder someone made by hand, rather than hiding the work", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    await fs.mkdir(path.join(root, "Projects", "SM2026-004a Rogue Job"), { recursive: true });
    const projects = await store.listProjects(workspace);
    expect(projects.map((p) => p.id)).toContain("SM2026-004a");
    expect(projects.find((p) => p.id === "SM2026-004a")?.name).toBe("Rogue Job");
  });

  it("ignores folders that carry no job code", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    await fs.mkdir(path.join(root, "Projects", "Old Stuff"), { recursive: true });
    const projects = await store.listProjects(workspace);
    expect(projects).toHaveLength(0);
  });

  it("returns an empty list before any project exists", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    expect(await store.listProjects(workspace)).toEqual([]);
  });
});

describe("documents", () => {
  it("writes a document into its section and lists it", async () => {
    const workspace = await store.ensureWorkspace("Sculptivate");
    const project = await store.createProject(workspace, {
      code: requireJobCode("PROD2026-001a"),
      name: "Winter Gala",
      client: "Northern Arts Trust",
      company: "Sculptivate",
      productionManager: "A. Reed",
      status: "confirmed",
      venues: [],
    });

    await store.putDocument(project, "01 RAMS", "Risk Assessment PROD2026-001a.docx", Buffer.from("PK\x03\x04test"));
    const documents = await store.listDocuments(project, "01 RAMS");
    expect(documents).toHaveLength(1);
    expect(documents[0].name).toBe("Risk Assessment PROD2026-001a.docx");
  });
});
