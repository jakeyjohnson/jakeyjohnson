/**
 * Per-tenant branding.
 *
 * A RAMS pack goes to venues, clients and safety officers under the
 * production company's name, so the company's own logo and colours are not
 * decoration — they are what makes the document theirs. Branding is stored
 * with the workspace, applied to both the app UI and every generated
 * document, so a company sees their identity from the moment they sign in.
 */

export interface Branding {
  companyName: string;
  /** Shown in document headers where set; the app falls back to the name. */
  logo?: StoredLogo;
  theme: Theme;
  /** Printed in the footer of every generated document. */
  documentFooter?: string;
  /** Appears on method statement sign-off blocks. */
  registeredDetails?: string;
}

export interface StoredLogo {
  /** Stored alongside the workspace, not hotlinked. */
  filename: string;
  mimeType: string;
  /** Base64, so the logo travels with the workspace manifest. */
  data: string;
  widthPx: number;
  heightPx: number;
}

export interface Theme {
  /** Primary brand colour, hex including the leading #. */
  primary: string;
  /** Used for headings and document rules. */
  ink: string;
  /** Page background. */
  surface: string;
  /** Accent for interactive elements. */
  accent: string;
  /** Applied to the app shell. Documents are always light. */
  mode: "light" | "dark";
  /** Heading typeface stack. */
  headingFont: string;
}

export const DEFAULT_THEME: Theme = {
  primary: "#1b3a5c",
  ink: "#12181f",
  surface: "#ffffff",
  accent: "#c8963e",
  mode: "light",
  headingFont: "var(--font-geist-sans), system-ui, sans-serif",
};

export function defaultBranding(companyName: string): Branding {
  return { companyName, theme: { ...DEFAULT_THEME } };
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A bad colour must not be able to break the document generator, which writes
 * raw hex into OOXML. Invalid values fall back rather than throwing, but the
 * caller is told, so the settings form can show it.
 */
export function sanitiseTheme(input: Partial<Theme>): { theme: Theme; rejected: string[] } {
  const rejected: string[] = [];
  const theme: Theme = { ...DEFAULT_THEME };

  for (const key of ["primary", "ink", "surface", "accent"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (HEX.test(value)) {
      theme[key] = value;
    } else {
      rejected.push(key);
    }
  }

  if (input.mode === "light" || input.mode === "dark") theme.mode = input.mode;
  if (input.headingFont && input.headingFont.length <= 200) {
    theme.headingFont = input.headingFont;
  } else if (input.headingFont) {
    rejected.push("headingFont");
  }

  return { theme, rejected };
}

/** OOXML wants bare hex with no leading #. */
export function ooxmlColour(hex: string): string {
  return (HEX.test(hex) ? hex : DEFAULT_THEME.primary).replace("#", "").toUpperCase();
}

/** Emits the theme as CSS custom properties for the app shell. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  return {
    "--brand-primary": theme.primary,
    "--brand-ink": theme.ink,
    "--brand-surface": theme.surface,
    "--brand-accent": theme.accent,
    "--brand-heading-font": theme.headingFont,
  };
}

export const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;

/** Drive and OOXML both choke on oversized images; 2MB is generous for a logo. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function validateLogo(file: { mimeType: string; size: number }): string | null {
  if (!ACCEPTED_LOGO_TYPES.includes(file.mimeType as (typeof ACCEPTED_LOGO_TYPES)[number])) {
    return `Logo must be PNG, JPEG or SVG. Received ${file.mimeType}.`;
  }
  if (file.size > MAX_LOGO_BYTES) {
    return `Logo must be under ${MAX_LOGO_BYTES / 1024 / 1024}MB.`;
  }
  return null;
}
