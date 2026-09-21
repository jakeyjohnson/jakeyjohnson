import { describe, expect, it } from "vitest";
import {
  MAX_LOGO_BYTES,
  ooxmlColour,
  sanitiseTheme,
  themeToCssVars,
  validateLogo,
} from "../branding";

describe("theme sanitising", () => {
  it("accepts valid hex, long and short form", () => {
    const { theme, rejected } = sanitiseTheme({ primary: "#abc", accent: "#AABBCC" });
    expect(theme.primary).toBe("#abc");
    expect(theme.accent).toBe("#AABBCC");
    expect(rejected).toEqual([]);
  });

  it("rejects a bad colour and reports it rather than throwing", () => {
    const { theme, rejected } = sanitiseTheme({ primary: "red" });
    expect(rejected).toContain("primary");
    expect(theme.primary).toBe("#1b3a5c");
  });

  it("rejects an absurdly long font stack", () => {
    const { rejected } = sanitiseTheme({ headingFont: "x".repeat(500) });
    expect(rejected).toContain("headingFont");
  });

  it("ignores an invalid mode", () => {
    const { theme } = sanitiseTheme({ mode: "neon" as never });
    expect(theme.mode).toBe("light");
  });
});

describe("ooxml colours", () => {
  it("strips the hash and upper-cases", () => {
    expect(ooxmlColour("#1b3a5c")).toBe("1B3A5C");
  });

  it("falls back rather than emitting invalid ooxml", () => {
    expect(ooxmlColour("rgb(1,2,3)")).toBe("1B3A5C");
  });
});

describe("css vars", () => {
  it("exposes the theme to the app shell", () => {
    const vars = themeToCssVars(sanitiseTheme({ primary: "#123456" }).theme);
    expect(vars["--brand-primary"]).toBe("#123456");
  });
});

describe("logo validation", () => {
  it("accepts png, jpeg and svg", () => {
    for (const mimeType of ["image/png", "image/jpeg", "image/svg+xml"]) {
      expect(validateLogo({ mimeType, size: 1000 })).toBeNull();
    }
  });

  it("rejects other formats by name", () => {
    expect(validateLogo({ mimeType: "image/gif", size: 10 })).toMatch(/PNG, JPEG or SVG/);
  });

  it("rejects an oversized file", () => {
    expect(validateLogo({ mimeType: "image/png", size: MAX_LOGO_BYTES + 1 })).toMatch(/under 2MB/);
  });
});
