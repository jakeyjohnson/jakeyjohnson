# Scribble Labs tools

Everything under `tools/` is a Scribble Labs plugin or tool for live sound. Brand assets and rules are in `tools/brand/`.

For every Scribble Labs plugin GUI:

- **Accent:** use strip amber `#FFB020` (tokens in `tools/brand/scribble-labs.css`) for primary buttons, selected and "on" states, toggles, checkboxes, progress bars and focus rings. Put `#16191D` text on amber. On light backgrounds, use `#9A5B00` for amber text and focus rings. Warnings are orange, not amber. No other accent colour.
- **Branding:** the mark in the header with "Scribble Labs · <tool name>", the mark as the favicon, and a maker's plate (mark plus SCRIBBLE LABS in spaced capitals) in the footer or on the device surface. See `tools/brand/README.md`.
- **Footer:** "Scribble Labs · <tool> v<version> · Licence <number>" at the bottom, read from the tool's `about.js` (version matches `package.json`; licence numbers look like SL-SB-0001).
- **Wording:** short and plain, the way an engineer talks at the desk. Name things by what people see (inputs, outputs, sockets), not internal terms. No "Please", "Successfully" or exclamation marks.
- **Offline:** tools must work offline: no network calls, no API keys, no CDN-only dependencies in the shipped tool.
