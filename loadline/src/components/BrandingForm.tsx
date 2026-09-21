"use client";

import { useActionState, useState } from "react";
import { saveBranding, type ActionResult } from "@/app/actions";
import { Field, inputClass } from "@/components/Field";
import type { Branding } from "@/domain/branding";

const COLOURS = [
  ["primary", "Primary", "Headings, buttons and document titles."],
  ["accent", "Accent", "Highlights and interactive detail."],
  ["ink", "Text", "Body text colour."],
  ["surface", "Background", "Page background."],
] as const;

export function BrandingForm({ branding }: { branding: Branding }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveBranding,
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);

  const currentLogo = branding.logo
    ? `data:${branding.logo.mimeType};base64,${branding.logo.data}`
    : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Branding</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Applied to this app and to the header of every document Loadline
        generates. A RAMS pack goes out under your name, so it should look like
        it came from you.
      </p>

      <form action={action} className="mt-8 space-y-8">
        <section className="space-y-5">
          <Field label="Company name">
            <input
              name="companyName"
              defaultValue={branding.companyName}
              className={inputClass}
            />
          </Field>

          <Field
            label="Logo"
            hint="PNG, JPEG or SVG, under 2MB. Sits in the header of every generated document. SVG displays in the app but falls back to your company name inside documents, which Word handles more reliably."
          >
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml"
              className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-[var(--raised)] file:px-3 file:py-1 file:text-sm`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </Field>

          {(preview || currentLogo) && (
            <div className="rounded-md border border-[var(--rule)] p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                {preview ? "New logo" : "Current logo"}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview ?? currentLogo!}
                alt="Company logo"
                className="h-12 w-auto max-w-[220px] object-contain"
              />
              {currentLogo && !preview && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removeLogo" />
                  Remove logo
                </label>
              )}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Theme</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {COLOURS.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    name={key}
                    defaultValue={normaliseHex(branding.theme[key])}
                    className="h-9 w-12 cursor-pointer rounded border border-[var(--rule)] bg-transparent"
                  />
                  <span className="code text-xs text-[var(--muted)]">
                    {branding.theme[key]}
                  </span>
                </div>
              </Field>
            ))}
          </div>

          <Field label="App mode">
            <select name="mode" defaultValue={branding.theme.mode} className={inputClass}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>

          <Field label="Heading font stack" hint="CSS font-family value.">
            <input
              name="headingFont"
              defaultValue={branding.theme.headingFont}
              className={`${inputClass} code text-xs`}
            />
          </Field>
        </section>

        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Documents</h2>
          <Field
            label="Footer line"
            hint="Printed at the foot of every generated document. Defaults to your company name and pack version."
          >
            <input
              name="documentFooter"
              defaultValue={branding.documentFooter ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Registered details"
            hint="Company number, registered address, insurer. Appears under the method statement sign-off."
          >
            <textarea
              name="registeredDetails"
              defaultValue={branding.registeredDetails ?? ""}
              rows={3}
              className={inputClass}
            />
          </Field>
        </section>

        {state && (
          <p
            className="rounded-md px-3 py-2 text-sm"
            style={{
              background: state.ok ? "var(--band-low)" : "var(--band-medium)",
              color: "var(--band-text)",
            }}
          >
            {state.ok ? state.message : state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--brand-primary)" }}
        >
          {pending ? "Saving…" : "Save branding"}
        </button>
      </form>
    </div>
  );
}

/** <input type="color"> only accepts six-digit hex, never the shorthand. */
function normaliseHex(value: string): string {
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1b3a5c";
}
