"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProject, type ActionResult } from "@/app/actions";
import { Field, inputClass } from "@/components/Field";

export default function NewProjectPage() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProject,
    null,
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">New project</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        The job code is issued from the workspace register, so it is unique and
        never retyped.
      </p>

      <form action={action} className="mt-8 space-y-5">
        <Field label="Project name">
          <input name="name" required className={inputClass} placeholder="Winter Gala" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Series" hint="PROD for production, SM for stage management.">
            <select name="prefix" className={inputClass} defaultValue="PROD">
              <option value="PROD">PROD</option>
              <option value="SM">SM</option>
            </select>
          </Field>

          <Field label="Status">
            <select name="status" className={inputClass} defaultValue="enquiry">
              {["enquiry", "quoted", "confirmed", "in-build", "on-site", "complete"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Client">
            <input name="client" className={inputClass} placeholder="Northern Arts Trust" />
          </Field>

          <Field label="Production manager">
            <input name="productionManager" className={inputClass} />
          </Field>

          <Field label="Start date">
            <input type="date" name="startDate" className={inputClass} />
          </Field>

          <Field label="End date">
            <input type="date" name="endDate" className={inputClass} />
          </Field>
        </div>

        <Field label="Venues" hint="Comma separated.">
          <input name="venues" className={inputClass} placeholder="Leeds Playhouse, Sheffield Crucible" />
        </Field>

        {state && !state.ok && (
          <p className="rounded-md border border-[var(--band-critical)] bg-[var(--band-critical)]/30 px-3 py-2 text-sm">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--brand-primary)" }}
          >
            {pending ? "Creating…" : "Create project"}
          </button>
          <Link href="/" className="text-sm text-[var(--muted)] hover:underline underline-offset-4">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
