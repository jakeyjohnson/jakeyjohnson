"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore, getWorkspace } from "@/lib/workspace";
import { generatePack } from "@/documents/pack";
import { formatJobCode } from "@/domain/job-code";
import { sanitiseTheme, validateLogo, type StoredLogo } from "@/domain/branding";
import type { ProjectStatus } from "@/domain/types";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function createProject(_prev: ActionResult | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const prefix = String(form.get("prefix") ?? "PROD").trim();

  if (!name) return { ok: false as const, error: "Give the project a name." };

  const store = getStore();
  const workspace = await getWorkspace();

  let created;
  try {
    const { code, workspace: updated } = await store.issueCode(
      workspace,
      prefix,
      new Date().getFullYear(),
    );
    created = await store.createProject(updated, {
      code,
      name,
      client: String(form.get("client") ?? "").trim(),
      company: updated.companyName,
      productionManager: String(form.get("productionManager") ?? "").trim(),
      status: (String(form.get("status") ?? "enquiry") as ProjectStatus) || "enquiry",
      venues: String(form.get("venues") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      startDate: String(form.get("startDate") ?? "") || undefined,
      endDate: String(form.get("endDate") ?? "") || undefined,
    });
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }

  revalidatePath("/");
  redirect(`/projects/${created.id}`);
}

/**
 * Generates the full base pack for a project.
 *
 * Every document lands in the folder it belongs to, branded and carrying the
 * project's job code. Documents that contain placeholders are counted and
 * reported, because a pack that looks finished but is not is worse than one
 * that obviously needs work.
 */
export async function generateDocumentPack(projectId: string): Promise<ActionResult> {
  const store = getStore();
  const workspace = await getWorkspace();
  const project = await store.getProject(workspace, projectId);
  if (!project) return { ok: false, error: `No project ${projectId}.` };

  let written = 0;
  let needingCompletion = 0;

  try {
    const documents = await generatePack(project, workspace);
    for (const document of documents) {
      await store.putDocument(project, document.section, document.filename, document.contents);
      written += 1;
      if (document.needsCompletion) needingCompletion += 1;
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  revalidatePath(`/projects/${projectId}`);

  const code = formatJobCode(project.code);
  return {
    ok: true,
    message: `${written} documents issued as ${code}. ${needingCompletion} contain placeholders that must be completed before issue.`,
  };
}

export async function saveBranding(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const store = getStore();
  const workspace = await getWorkspace();

  const { theme, rejected } = sanitiseTheme({
    primary: String(form.get("primary") ?? ""),
    ink: String(form.get("ink") ?? ""),
    surface: String(form.get("surface") ?? ""),
    accent: String(form.get("accent") ?? ""),
    mode: String(form.get("mode") ?? "light") as "light" | "dark",
    headingFont: String(form.get("headingFont") ?? "") || undefined,
  });

  let logo: StoredLogo | undefined = workspace.branding.logo;

  const upload = form.get("logo");
  if (upload instanceof File && upload.size > 0) {
    const problem = validateLogo({ mimeType: upload.type, size: upload.size });
    if (problem) return { ok: false, error: problem };

    const bytes = Buffer.from(await upload.arrayBuffer());
    const dimensions = readPngDimensions(bytes);
    logo = {
      filename: upload.name,
      mimeType: upload.type,
      data: bytes.toString("base64"),
      // SVG and JPEG dimensions are not read here, so they fall back to the
      // header band size rather than being scaled. Worth revisiting when the
      // first company uploads a tall JPEG logo.
      widthPx: dimensions?.width ?? 0,
      heightPx: dimensions?.height ?? 0,
    };
  }

  if (form.get("removeLogo") === "on") logo = undefined;

  await store.saveWorkspace({
    ...workspace,
    branding: {
      ...workspace.branding,
      companyName: String(form.get("companyName") ?? "").trim() || workspace.branding.companyName,
      documentFooter: String(form.get("documentFooter") ?? "").trim() || undefined,
      registeredDetails: String(form.get("registeredDetails") ?? "").trim() || undefined,
      theme,
      logo,
    },
  });

  revalidatePath("/", "layout");

  if (rejected.length) {
    return {
      ok: false,
      error: `Saved, but these were not valid and kept their previous value: ${rejected.join(", ")}.`,
    };
  }
  return { ok: true, message: "Branding saved. It applies to the app and every document from now on." };
}

/**
 * Reads width and height from a PNG IHDR chunk.
 *
 * Avoids pulling an image library in for two integers. Returns null for
 * anything that is not a PNG, and the caller falls back.
 */
function readPngDimensions(bytes: Buffer): { width: number; height: number } | null {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(SIGNATURE)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
