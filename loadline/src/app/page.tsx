import Link from "next/link";
import { getStore, getWorkspace } from "@/lib/workspace";
import { formatJobCode } from "@/domain/job-code";
import type { ProjectStatus } from "@/domain/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  enquiry: "Enquiry",
  quoted: "Quoted",
  confirmed: "Confirmed",
  "in-build": "In build",
  "on-site": "On site",
  complete: "Complete",
  cancelled: "Cancelled",
};

export default async function ProjectsPage() {
  const store = getStore();
  const workspace = await getWorkspace();
  const projects = await store.listProjects(workspace);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {projects.length === 0
              ? "No projects yet."
              : `${projects.length} project${projects.length === 1 ? "" : "s"}, newest first.`}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-primary)" }}
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--rule)] p-10 text-center">
          <p className="text-sm text-[var(--muted)]">
            Create a project and Loadline issues its job code, builds its folder
            structure and generates its RAMS pack.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 transition-colors hover:bg-[var(--raised)]"
              >
                <span
                  className="code text-sm font-medium"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {formatJobCode(project.code)}
                </span>
                <span className="text-base font-medium">{project.name}</span>
                {project.client && (
                  <span className="text-sm text-[var(--muted)]">{project.client}</span>
                )}
                <span className="ml-auto text-xs uppercase tracking-wide text-[var(--muted)]">
                  {STATUS_LABEL[project.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
