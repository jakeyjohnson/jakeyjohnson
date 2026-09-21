import path from "node:path";
import { LocalStore } from "@/store/local";
import type { DocumentStore } from "@/store/types";
import type { Workspace } from "@/domain/types";

/**
 * Resolves the store for the current request.
 *
 * Development and demos run entirely on the local filesystem — no Google
 * account is connected and no Drive is touched. LOADLINE_WORKSPACE_DIR sets
 * where that lives; it defaults to a gitignored folder in the project so a
 * fresh clone works with no setup.
 *
 * Connecting a tenant's Drive swaps LocalStore for DriveStore behind this same
 * interface. That is a deliberate later step: a company should be able to try
 * the product before handing over access to their document archive.
 */
export function getStore(): DocumentStore {
  const dir =
    process.env.LOADLINE_WORKSPACE_DIR ??
    path.join(process.cwd(), ".loadline-workspace");
  return new LocalStore(dir);
}

export function getCompanyName(): string {
  return process.env.LOADLINE_COMPANY_NAME ?? "Your Company";
}

export async function getWorkspace(): Promise<Workspace> {
  return getStore().ensureWorkspace(getCompanyName());
}
