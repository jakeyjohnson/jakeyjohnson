import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore, getWorkspace } from "@/lib/workspace";
import { formatJobCode } from "@/domain/job-code";
import { HAZARD_LIBRARY } from "@/domain/hazard-library";
import { requiresEscalation, score, type RiskBand } from "@/domain/risk";
import { GenerateRams } from "@/components/GenerateRams";

export const dynamic = "force-dynamic";

const BAND_VAR: Record<RiskBand, string> = {
  LOW: "var(--band-low)",
  MEDIUM: "var(--band-medium)",
  HIGH: "var(--band-high)",
  CRITICAL: "var(--band-critical)",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getStore();
  const workspace = await getWorkspace();
  const project = await store.getProject(workspace, decodeURIComponent(id));
  if (!project) notFound();

  const documents = await store.listDocuments(project, "01 RAMS");
  const hazards = HAZARD_LIBRARY.flatMap((activity) =>
    activity.hazards.map((hazard) => ({ activity, hazard })),
  );

  return (
    <div>
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline underline-offset-4">
        ← Projects
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="code text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
          {formatJobCode(project.code)}
        </span>
        <h1 className="text-3xl font-semibold">{project.name}</h1>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
        {[
          ["Client", project.client],
          ["Production manager", project.productionManager],
          ["Status", project.status],
          ["Venues", project.venues.join(", ")],
          ["Dates", [project.startDate, project.endDate].filter(Boolean).join(" → ")],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
            <dd className="mt-0.5">{value || <span className="text-[var(--muted)]">—</span>}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">RAMS</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Generating writes a risk assessment and method statement into this
          project&rsquo;s <span className="code">01 RAMS</span> folder, branded and
          numbered {formatJobCode(project.code)}.
        </p>

        <div className="mt-4">
          <GenerateRams projectId={project.id} />
        </div>

        {documents.length > 0 && (
          <ul className="mt-6 divide-y divide-[var(--rule)] border-y border-[var(--rule)] text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                <span className="font-medium">{doc.name}</span>
                <span className="ml-auto text-xs text-[var(--muted)]">
                  {new Date(doc.modifiedTime).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Risk register</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          What the generated assessment will contain. Ratings are likelihood ×
          severity, before and after controls.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Activity</th>
                <th className="py-2 pr-4 font-medium">Hazard</th>
                <th className="py-2 pr-4 font-medium">Before</th>
                <th className="py-2 pr-4 font-medium">Controls</th>
                <th className="py-2 font-medium">Residual</th>
              </tr>
            </thead>
            <tbody>
              {hazards.map(({ activity, hazard }) => {
                const before = score(hazard.before.likelihood, hazard.before.severity);
                const after = score(hazard.after.likelihood, hazard.after.severity);
                return (
                  <tr key={hazard.id} className="border-b border-[var(--rule)] align-top">
                    <td className="py-3 pr-4 text-[var(--muted)]">{activity.name}</td>
                    <td className="py-3 pr-4">{hazard.description}</td>
                    <td className="py-3 pr-4">
                      <RiskPill rating={before.rating} band={before.band} />
                    </td>
                    <td className="py-3 pr-4 text-[var(--muted)]">
                      {hazard.controls.length} measure
                      {hazard.controls.length === 1 ? "" : "s"}
                    </td>
                    <td className="py-3">
                      <RiskPill rating={after.rating} band={after.band} />
                      {requiresEscalation(after) && (
                        <span className="mt-1 block text-xs font-medium">
                          Escalate before work starts
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RiskPill({ rating, band }: { rating: number; band: RiskBand }) {
  return (
    <span
      className="inline-block rounded px-2 py-1 text-xs font-semibold"
      style={{ background: BAND_VAR[band], color: "var(--band-text)" }}
    >
      {rating} {band}
    </span>
  );
}
