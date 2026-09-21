"use client";

import { useState, useTransition } from "react";
import { generateRams, type ActionResult } from "@/app/actions";

export function GenerateRams({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await generateRams(projectId)))}
        className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--brand-primary)" }}
      >
        {pending ? "Generating…" : "Generate RAMS pack"}
      </button>

      {result && (
        <p
          className="mt-3 rounded-md px-3 py-2 text-sm"
          style={{
            background: result.ok ? "var(--band-low)" : "var(--band-critical)",
            color: "var(--band-text)",
          }}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
