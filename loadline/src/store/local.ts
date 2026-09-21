import { promises as fs } from "node:fs";
import path from "node:path";
import type { Project, Workspace } from "@/domain/types";
import { formatJobCode, nextInSeries, parseJobCode } from "@/domain/job-code";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { defaultBranding } from "@/domain/branding";
import {
  DOCX_MIME,
  PROJECT_SECTIONS,
  type DocumentStore,
  type ProjectSection,
  type StoredDocument,
} from "./types";

/**
 * Filesystem-backed store.
 *
 * The default. Everything development and demos run against, so no connected
 * Drive is ever touched while building. The folder tree it produces is
 * deliberately identical to the one DriveStore produces, which means a
 * workspace can be moved between the two by copying a directory.
 */
export class LocalStore implements DocumentStore {
  constructor(private readonly root: string) {}

  private get workspaceFile() {
    return path.join(this.root, "workspace.json");
  }

  private get projectsDir() {
    return path.join(this.root, "Projects");
  }

  private projectDir(project: Project): string {
    if (!project.folderId) throw new Error(`Project ${project.id} has no folder`);
    return project.folderId;
  }

  async ensureWorkspace(companyName: string): Promise<Workspace> {
    await fs.mkdir(this.projectsDir, { recursive: true });

    try {
      const raw = await fs.readFile(this.workspaceFile, "utf8");
      const parsed = JSON.parse(raw) as Workspace;
      return { ...parsed, rootFolderId: this.root };
    } catch (error) {
      if (!isMissing(error)) {
        throw new Error(
          `workspace.json could not be read (${(error as Error).message}). It may have been edited by hand.`,
        );
      }
    }

    const workspace: Workspace = {
      companyName,
      branding: defaultBranding(companyName),
      seriesPrefixes: ["PROD", "SM"],
      issuedCodes: [],
      defaultCirculation: [
        "Venue Management",
        "Production Crew",
        "Performers",
        "Production & Company Office",
      ],
      packVersion: "General Risk Assessment Pack Updated 2025 Version 1.1. June 2025",
      rootFolderId: this.root,
    };
    await this.saveWorkspace(workspace);
    await writeJson(path.join(this.root, "hazard-library.json"), HAZARD_LIBRARY);
    return workspace;
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await writeJson(this.workspaceFile, workspace);
  }

  async issueCode(workspace: Workspace, prefix: string, year: number) {
    if (!workspace.seriesPrefixes.includes(prefix)) {
      throw new Error(
        `${prefix} is not a series this workspace issues. Known series: ${workspace.seriesPrefixes.join(", ")}`,
      );
    }
    const code = nextInSeries(prefix, year, workspace.issuedCodes);
    const updated: Workspace = {
      ...workspace,
      issuedCodes: [...workspace.issuedCodes, code],
    };
    await this.saveWorkspace(updated);
    return { code, workspace: updated };
  }

  async createProject(
    workspace: Workspace,
    project: Omit<Project, "id" | "folderId">,
  ): Promise<Project> {
    const id = formatJobCode(project.code);
    const folderId = path.join(this.projectsDir, `${id} ${project.name}`.trim());
    await fs.mkdir(folderId, { recursive: true });
    for (const section of PROJECT_SECTIONS) {
      await fs.mkdir(path.join(folderId, section), { recursive: true });
    }
    const stored: Project = { ...project, id, folderId };
    await this.saveProject(stored);
    return stored;
  }

  async listProjects(workspace: Workspace): Promise<Project[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.projectsDir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }

    const projects: Project[] = [];
    for (const entry of entries.sort().reverse()) {
      const dir = path.join(this.projectsDir, entry);
      if (!(await fs.stat(dir)).isDirectory()) continue;

      try {
        const raw = await fs.readFile(path.join(dir, "project.json"), "utf8");
        projects.push({ ...(JSON.parse(raw) as Project), folderId: dir });
        continue;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }

      // A folder made by hand. Surface it rather than hiding it: work that
      // never got a manifest is exactly what tends to go undocumented.
      const code = parseJobCode(entry.split(" ")[0]);
      if (code) {
        projects.push({
          id: formatJobCode(code),
          code,
          name: entry.split(" ").slice(1).join(" "),
          client: "",
          company: workspace.companyName,
          productionManager: "",
          status: "enquiry",
          venues: [],
          folderId: dir,
        });
      }
    }
    return projects;
  }

  async getProject(workspace: Workspace, id: string): Promise<Project | null> {
    const projects = await this.listProjects(workspace);
    return projects.find((p) => p.id === id) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    await writeJson(path.join(this.projectDir(project), "project.json"), project);
  }

  async putDocument(
    project: Project,
    section: ProjectSection,
    filename: string,
    contents: Buffer,
    mimeType = DOCX_MIME,
  ): Promise<StoredDocument> {
    const dir = path.join(this.projectDir(project), section);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, filename);
    await fs.writeFile(file, contents);
    const stat = await fs.stat(file);
    return {
      id: file,
      name: filename,
      mimeType,
      modifiedTime: stat.mtime.toISOString(),
      link: `file://${file}`,
    };
  }

  async listDocuments(project: Project, section: ProjectSection): Promise<StoredDocument[]> {
    const dir = path.join(this.projectDir(project), section);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }

    const documents: StoredDocument[] = [];
    for (const name of names) {
      const file = path.join(dir, name);
      const stat = await fs.stat(file);
      if (!stat.isFile()) continue;
      documents.push({
        id: file,
        name,
        mimeType: name.endsWith(".docx") ? DOCX_MIME : "application/octet-stream",
        modifiedTime: stat.mtime.toISOString(),
        link: `file://${file}`,
      });
    }
    return documents.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}
