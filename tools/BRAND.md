# KobiKraken tools

Everything under `tools/` is a KobiKraken plugin or tool for live sound. Brand assets and the short guide are in `tools/brand/` (from *KobiKraken Brand Guidelines v1.0*).

For every KobiKraken plugin GUI:

- **Colour:** almost monochrome. Kraken Ink `#11151A`, Shell White `#F5F4F0`, Control Grey `#7A8087` (tokens in `tools/brand/kobikraken.css`). Each tool gets one product accent (Spectral `#63CBE8`, Space `#9687EF`, Drive `#F4B36A` or Motion `#9AD4B8`) for primary buttons, selection, focus rings, toggles, meters and curves, with Kraken Ink text on it. The Show Builder uses Spectral. Never use colour alone for status.
- **Logo:** use the supplied SVGs in `tools/brand/` unchanged, one solid colour (ink or white), never redrawn. K at least 40 px in a header, wordmark at least 160 px wide.
- **Branding:** a raised graphite product bar (`#1E242C`, 16 px radius) at the top with the white K and "KOBI / <TOOL NAME>" in uppercase, as on the guide's interface page. `kobikraken-icon.svg` as the favicon. The footer has the wordmark as the maker's plate on the left, and the version and licence in mono on the right, above a 1 px rule. See `tools/brand/README.md`.
- **Look:** dark only for tool GUIs (the guide's "calm control room"): Kraken Ink surfaces, values and units in a monospace face, uppercase table labels. Printed paperwork stays light.
- **Lighting and watermark (Jakey's call):** the page background is lit with soft gradients: graphite light from the top centre, a faint Spectral glow, darker towards the bottom. Raised surfaces (product bar, panels, primary buttons) get gentle gradients too. The K sits fixed in the centre as a large watermark (solid Shell White at about 4% opacity, behind everything, never over text). The logo itself never gets a gradient.
- **Type:** Inter (bundled in `tools/brand/fonts/`), tabular numerals for values, units always shown.
- **Footer:** the wordmark plus "<tool> v<version> · Licence <number>" at the bottom, read from the tool's `about.js` (version matches `package.json`; licence numbers look like KK-SB-0001).
- **Wording:** short and plain, the way an engineer talks at the desk. Name things by what people see (inputs, outputs, sockets), not internal terms. No "Please", "Successfully", hype or exclamation marks.
- **Offline:** tools must work offline: no network calls, no API keys, no CDN-only dependencies in the shipped tool.
