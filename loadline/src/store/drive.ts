import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Project, Workspace } from "@/domain/types";
import { formatJobCode, nextInSeries, parseJobCode, type JobCode } from "@/domain/job-code";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { defaultBranding } from "@/domain/branding";
import {
  DOCX_MIME,
  PROJECT_SECTIONS,
  type DocumentStore,
  type ProjectSection,
  type StoredDocument,
} from "@/store/types";

/**
 * Google Drive as the store.
 *
 * There is no database. A workspace is a folder in the tenant's own Drive,
 * and every project is a folder inside it holding a project.json manifest
 * alongside the documents themselves. That means the production team keeps
 * working in the place they already look — Drive — and the app never becomes
 * a second source of truth that drifts from the files people actually send to
 * clients.
 *
 * Multi-tenancy falls out of this for free: each company connects its own
 * Google account, and their data never leaves their Drive.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const WORKSPACE_FILE = "workspace.json";
const PROJECT_FILE = "project.json";
const LIBRARY_FILE = "hazard-library.json";

/** Marks files as ours so a Drive-wide search can find a workspace the user moved. */
const APP_TAG = { loadline: "v1" };

export class DriveStore implements DocumentStore {
  private readonly drive: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth });
  }

  // --- folders ------------------------------------------------------------

  private async findChild(parentId: string, name: string, mimeType?: string) {
    const clauses = [
      `'${parentId}' in parents`,
      `name = ${quote(name)}`,
      "trashed = false",
    ];
    if (mimeType) clauses.push(`mimeType = '${mimeType}'`);
    const res = await this.drive.files.list({
      q: clauses.join(" and "),
      fields: "files(id, name, mimeType)",
      pageSize: 1,
    });
    return res.data.files?.[0] ?? null;
  }

  private async ensureFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.findChild(parentId, name, FOLDER_MIME);
    if (existing?.id) return existing.id;
    const created = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
        appProperties: APP_TAG,
      },
      fields: "id",
    });
    if (!created.data.id) throw new Error(`Drive did not return an id for folder ${name}`);
    return created.data.id;
  }

  // --- json manifests -----------------------------------------------------

  private async readJson<T>(parentId: string, name: string): Promise<T | null> {
    const file = await this.findChild(parentId, name);
    if (!file?.id) return null;
    const res = await this.drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "text" },
    );
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error(
        `${name} in Drive is not valid JSON. It may have been edited by hand; restore it from Drive's version history.`,
      );
    }
  }

  private async writeJson(parentId: string, name: string, value: unknown): Promise<string> {
    const body = JSON.stringify(value, null, 2);
    const existing = await this.findChild(parentId, name);
    const media = { mimeType: "application/json", body };
    if (existing?.id) {
      await this.drive.files.update({ fileId: existing.id, media });
      return existing.id;
    }
    const created = await this.drive.files.create({
      requestBody: { name, parents: [parentId], appProperties: APP_TAG },
      media,
      fields: "id",
    });
    if (!created.data.id) throw new Error(`Drive did not return an id for ${name}`);
    return created.data.id;
  }

  // --- workspace ----------------------------------------------------------

  /**
   * Finds the workspace folder, creating it and seeding the hazard library on
   * first run. `rootName` is the folder the company keeps its production
   * paperwork in, so an existing team can point this at the folder they have.
   */
  async ensureWorkspace(companyName: string, rootName = "Loadline"): Promise<Workspace> {
    const rootFolderId = await this.ensureFolder("root", rootName);
    await this.ensureFolder(rootFolderId, "Projects");

    const existing = await this.readJson<Workspace>(rootFolderId, WORKSPACE_FILE);
    if (existing) return { ...existing, rootFolderId };

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
      rootFolderId,
    };
    await this.writeJson(rootFolderId, WORKSPACE_FILE, workspace);
    await this.writeJson(rootFolderId, LIBRARY_FILE, HAZARD_LIBRARY);
    return workspace;
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await this.writeJson(workspace.rootFolderId, WORKSPACE_FILE, workspace);
  }

  /**
   * Issues the next job code in a series and records it.
   *
   * Known limitation: this is a read-modify-write on a single Drive file, so
   * two people creating a project in the same series at the same moment can
   * both be handed the same number. Drive has no compare-and-swap. Until that
   * is addressed, a duplicate shows up as two projects with one code rather
   * than silent data loss, and `auditCodes` will report it.
   */
  async issueCode(workspace: Workspace, prefix: string, year: number): Promise<{
    code: JobCode;
    workspace: Workspace;
  }> {
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

  /** Codes issued more than once — the symptom of the race above. */
  auditCodes(workspace: Workspace): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const code of workspace.issuedCodes) {
      const text = formatJobCode(code);
      if (seen.has(text)) duplicates.add(text);
      seen.add(text);
    }
    return [...duplicates];
  }

  // --- projects -----------------------------------------------------------

  private async projectsFolder(workspace: Workspace): Promise<string> {
    return this.ensureFolder(workspace.rootFolderId, "Projects");
  }

  /** Folder name carries the code so Drive itself stays browsable and sorted. */
  private folderNameFor(project: Project): string {
    return `${formatJobCode(project.code)} ${project.name}`;
  }

  async createProject(
    workspace: Workspace,
    project: Omit<Project, "id" | "folderId">,
  ): Promise<Project> {
    const parentId = await this.projectsFolder(workspace);
    const withId: Project = { ...project, id: formatJobCode(project.code) };
    const folderId = await this.ensureFolder(parentId, this.folderNameFor(withId));

    for (const section of PROJECT_SECTIONS) {
      await this.ensureFolder(folderId, section);
    }

    const stored: Project = { ...withId, folderId };
    await this.writeJson(folderId, PROJECT_FILE, stored);
    return stored;
  }

  async listProjects(workspace: Workspace): Promise<Project[]> {
    const parentId = await this.projectsFolder(workspace);
    const res = await this.drive.files.list({
      q: `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 200,
      orderBy: "name desc",
    });

    const projects: Project[] = [];
    for (const folder of res.data.files ?? []) {
      if (!folder.id) continue;
      const manifest = await this.readJson<Project>(folder.id, PROJECT_FILE);
      if (manifest) {
        projects.push({ ...manifest, folderId: folder.id });
        continue;
      }
      // A folder someone created by hand in Drive. Surface it rather than
      // hiding it — half the value here is noticing work that never got a
      // manifest, and the folder name usually still carries the code.
      const code = parseJobCode((folder.name ?? "").split(" ")[0]);
      if (code) {
        projects.push({
          id: formatJobCode(code),
          code,
          name: (folder.name ?? "").split(" ").slice(1).join(" "),
          client: "",
          company: workspace.companyName,
          productionManager: "",
          status: "enquiry",
          venues: [],
          folderId: folder.id,
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
    if (!project.folderId) throw new Error(`Project ${project.id} has no Drive folder`);
    await this.writeJson(project.folderId, PROJECT_FILE, project);
  }

  // --- documents ----------------------------------------------------------

  /** Writes a generated document into the right section of the project folder. */
  async putDocument(
    project: Project,
    section: ProjectSection,
    filename: string,
    contents: Buffer,
    mimeType = DOCX_MIME,
  ): Promise<StoredDocument> {
    if (!project.folderId) throw new Error(`Project ${project.id} has no Drive folder`);
    const sectionId = await this.ensureFolder(project.folderId, section);
    const existing = await this.findChild(sectionId, filename);

    // Node streams are what the Drive client wants for binary bodies.
    const { Readable } = await import("node:stream");
    const media = { mimeType, body: Readable.from(contents) };

    if (existing?.id) {
      // Overwriting creates a new Drive revision rather than losing the old
      // one, so a reissued document keeps its history.
      const updated = await this.drive.files.update({
        fileId: existing.id,
        media,
        fields: "id, name, mimeType, modifiedTime, webViewLink",
      });
      return toStoredDocument(updated.data, filename, mimeType);
    }

    const created = await this.drive.files.create({
      requestBody: { name: filename, parents: [sectionId], appProperties: APP_TAG },
      media,
      fields: "id, name, mimeType, modifiedTime, webViewLink",
    });
    return toStoredDocument(created.data, filename, mimeType);
  }

  async listDocuments(project: Project, section: ProjectSection): Promise<StoredDocument[]> {
    if (!project.folderId) return [];
    const sectionId = await this.ensureFolder(project.folderId, section);
    const res = await this.drive.files.list({
      q: `'${sectionId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    });
    return (res.data.files ?? []).map((f) => toStoredDocument(f, f.name ?? "", f.mimeType ?? DOCX_MIME));
  }
}

function toStoredDocument(
  file: drive_v3.Schema$File,
  fallbackName: string,
  fallbackMime: string,
): StoredDocument {
  return {
    id: file.id ?? "",
    name: file.name ?? fallbackName,
    mimeType: file.mimeType ?? fallbackMime,
    modifiedTime: file.modifiedTime ?? new Date().toISOString(),
    link: file.webViewLink ?? "",
  };
}

/** Escapes a value for a Drive query string. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
