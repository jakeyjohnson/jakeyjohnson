import type { Project, Workspace } from "@/domain/types";
import type { JobCode } from "@/domain/job-code";

/**
 * The storage contract.
 *
 * Loadline keeps no database. Documents and their manifests live in a folder
 * tree, and that tree is the source of truth — so a production team can open
 * the folder directly and find exactly what the app shows them.
 *
 * Two implementations back this: `LocalStore` writes to the filesystem and is
 * what development and demos run against; `DriveStore` writes to whichever
 * Google Drive a tenant has authorised. Neither is hardcoded to any
 * particular account, and the app never touches a Drive it was not explicitly
 * connected to.
 */

export const PROJECT_SECTIONS = [
  "01 RAMS",
  "02 Procurement",
  "03 Schedule",
  "04 Licences",
  "05 Suppliers",
  "06 Drawings",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  /** Where a human can open it. A file:// path locally, a Drive link remotely. */
  link: string;
}

export interface DocumentStore {
  ensureWorkspace(companyName: string): Promise<Workspace>;
  saveWorkspace(workspace: Workspace): Promise<void>;

  /** Issues and records the next job code in a series. */
  issueCode(
    workspace: Workspace,
    prefix: string,
    year: number,
  ): Promise<{ code: JobCode; workspace: Workspace }>;

  createProject(
    workspace: Workspace,
    project: Omit<Project, "id" | "folderId">,
  ): Promise<Project>;
  listProjects(workspace: Workspace): Promise<Project[]>;
  getProject(workspace: Workspace, id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;

  putDocument(
    project: Project,
    section: ProjectSection,
    filename: string,
    contents: Buffer,
    mimeType?: string,
  ): Promise<StoredDocument>;
  listDocuments(project: Project, section: ProjectSection): Promise<StoredDocument[]>;
}

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
