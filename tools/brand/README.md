# KobiKraken

KobiKraken is the maker's name for my live-sound tools and plug-ins: **Kobi** (the German pet name for Jakob, so Jakey) and a kraken hidden in the K. The full guide is *KobiKraken Brand Guidelines v1.0* (Oct 2026); this is the short version for building tools.

**Professional. Playful. Precise.** Sound design with a little bite.

## Files

| File | Use |
|---|---|
| `kobikraken-k.svg` / `-k-white.svg` | The K on its own: favicons, plugin lists, splash screens, headers |
| `kobikraken-wordmark.svg` / `-white.svg` | The word on its own |
| `kobikraken-logo.svg` / `-white.svg` | Horizontal lockup, K and wordmark |
| `kobikraken-icon.svg` | The white K centred on a Kraken Ink tile: app icon and favicon |
| `icons/kobikraken-icon-{64,128,256,512}.png` | The same tile as PNGs |
| `kobikraken.css` | GUI tokens and the Inter font faces, to copy into each tool |
| `fonts/` | Inter (Regular, Medium, SemiBold, Bold), subset to Latin, with its licence (OFL 1.1) |

The SVGs are traced from the supplied master artwork. Use them as they are: don't redraw, recolour, outline, rotate or squeeze them, and never add a face, headphones or eyes.

## Logo rules

- **One colour only:** solid Kraken Ink or solid Shell White. Colour never fills the logo.
- **Clear space:** about 25% of the K's height on every side. No busy waves behind a small logo.
- **Minimum sizes:** K 48 px (preferred), wordmark 160 px wide, horizontal lockup 240 px wide. Below that, the suction cut-outs collapse.
- **App icons:** the K alone, centred, with generous margins. Never the wordmark on a small square icon. Check it at 48, 64, 128 and 256 px.

## Colour

Almost monochrome by design.

| Name | Hex | Where |
|---|---|---|
| Kraken Ink | `#11151A` | Dark backgrounds, the logo on light |
| Shell White | `#F5F4F0` | Light backgrounds, the logo on dark |
| Control Grey | `#7A8087` | Quiet lines and labels (use `#8E949B` for small text on dark, `#5F656C` on light, for 4.5:1 contrast) |

**Product accents** are for interaction and signal only: buttons, selection, focus, toggles, meters and curves. One accent per tool.

| Accent | Hex | For |
|---|---|---|
| Spectral | `#63CBE8` | EQ, analysis, and the Show Builder |
| Space | `#9687EF` | Reverb and space |
| Drive | `#F4B36A` | Saturation and drive |
| Motion | `#9AD4B8` | Dynamics |

- **Text on an accent:** Kraken Ink.
- **Accent as text on light backgrounds:** use the darker shade in `kobikraken.css` (`#1A6F87` for Spectral).
- **Status:** never by colour alone. Pair it with a word or an icon.

## Type

**Inter** throughout: SemiBold 600 or Bold 700 for titles, Regular 400 or Medium 500 for the interface. Tabular numerals for every value and meter, and always show the unit (Hz, kHz, dB, ms, %). UI labels 11–13 px minimum, section titles 16 px and up. Never over-track parameter labels.

## Interface

A calm control room: dark graphite surfaces, the most important decision obvious, hierarchy from spacing and contrast before colour. 8 px spacing grid (8 / 16 / 24 / 32). 1 px dividers, 2–3 px interactive lines, no bevels, gradients or shadows on the logo. Graphic texture comes from signal lines, fluid curves and measured dot grids, never nautical props.

## Stamping a tool

1. **Header:** the white K (at least 40 px tall) and "KobiKraken · <tool name>".
2. **Browser tab:** `kobikraken-icon.svg` as the favicon.
3. **Footer:** the wordmark (at least 160 px wide) as the maker's plate, then the version and licence line.
4. **Version and licence:** "KobiKraken · <tool> v<version> · Licence <number>", read from the tool's `about.js`, with the version matching its `package.json`. Licence numbers run KK-<tool code>-<4-digit copy number>, e.g. KK-SB-0001.

## Writing in the GUI

Talk like a good engineer sitting next to the user: useful, direct, quietly witty, never gimmicky. "That setting did not save. Try again.", not "ERROR 0x001 - FAILURE". Name things by what people see (inputs, outputs, sockets). No "Please", "Successfully", hype or exclamation marks, and never claim features a tool doesn't have.
