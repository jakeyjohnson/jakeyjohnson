# KobiKraken tools

Everything under `tools/` is a KobiKraken plugin or tool for live sound. Brand assets and the short guide are in `tools/brand/` (from *KobiKraken Brand Guidelines v1.0*).

For every KobiKraken plugin GUI:

- **Colour:** almost monochrome. Kraken Ink `#11151A`, Shell White `#F5F4F0`, Control Grey `#7A8087` (tokens in `tools/brand/kobikraken.css`). Each tool gets one product accent (Spectral `#63CBE8`, Space `#9687EF`, Drive `#F4B36A` or Motion `#9AD4B8`) for primary buttons, selection, focus rings, toggles, meters and curves, with Kraken Ink text on it. The Show Builder uses Spectral. Never use colour alone for status.
- **Logo:** use the supplied SVGs in `tools/brand/` unchanged, one solid colour (ink or white), never redrawn. K at least 40 px in a header, wordmark at least 160 px wide.
- **Branding:** the K in the header with "KobiKraken · <tool name>", `kobikraken-icon.svg` as the favicon, and the wordmark as the maker's plate in the footer. See `tools/brand/README.md`.
- **Type:** Inter (bundled in `tools/brand/fonts/`), tabular numerals for values, units always shown.
- **Footer:** "KobiKraken · <tool> v<version> · Licence <number>" at the bottom, read from the tool's `about.js` (version matches `package.json`; licence numbers look like KK-SB-0001).
- **Wording:** short and plain, the way an engineer talks at the desk. Name things by what people see (inputs, outputs, sockets), not internal terms. No "Please", "Successfully", hype or exclamation marks.
- **Offline:** tools must work offline: no network calls, no API keys, no CDN-only dependencies in the shipped tool.
