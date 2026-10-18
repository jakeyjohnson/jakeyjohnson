# KobiKlang

KobiKlang is the maker's name for my live-sound tools and plug-ins. **Kobi** is the German pet name for Jakob, which is Jakey in German, and **Klang** is German for sound. So KobiKlang is "Jakey's sound".

## Files

| File | Use |
|---|---|
| `kobiklang-mark.svg` | The mark on its own: app icons, favicons, the maker's plate on a device |
| `kobiklang-logo.svg` | Mark and wordmark, for light backgrounds |
| `kobiklang-logo-dark.svg` | Mark and wordmark, for dark backgrounds |
| `kobiklang.css` | GUI colour tokens to copy into each plugin |

## The mark

A **K** made from a fader. The fader slot is the K's upright stroke, an amber fader cap sits where the arms meet, and two sound waves ripple out to the right for the *Klang*. It all sits on a dark rounded tile, and stays readable down to 16 px.

## Colours

| Name | Hex | Where |
|---|---|---|
| Console black | `#16191D` | Tile, wordmark on light |
| Fader amber | `#FFB020` | Fader cap, sound waves, GUI accent |
| Fader cap white | `#E9EDF1` | The K's arms, wordmark on dark |
| Slot grey | `#9AA3AD` | The K's upright stroke |
| Label grey | `#7A838E` (light) / `#9AA3AD` (dark) | "Klang" in the wordmark |

## GUI colour

Every KobiKlang plugin uses **fader amber `#FFB020`** as its interface accent: primary buttons, selected and "on" states, toggles, checkboxes, progress bars and focus rings. Don't use any other accent colour.

- **Text on amber:** console black `#16191D`.
- **Amber as text on a light background:** use `#9A5B00`, because amber text on white is too faint to read. On dark backgrounds, plain `#FFB020` is fine.
- **Warnings:** orange (`#B4430A` light, `#FF8A4C` dark), so they never look like the accent.
- **Starting point:** `kobiklang.css` has these as ready-made tokens.

## Type

The wordmark is set in **Barlow Condensed** (Google Fonts, free): Bold for "Kobi", Regular for "Klang", in mixed case with both K's capitalised. The SVGs fall back to Arial Narrow where Barlow Condensed isn't installed. For print or signage, open the logo in a vector editor with Barlow Condensed installed and convert the text to outlines.

## Stamping a tool

Every KobiKlang tool carries the brand in four places:

1. **Header:** the mark at 28 px, then "KobiKlang · <tool name>" as the small line above the title.
2. **Browser tab:** `kobiklang-mark.svg` as the favicon.
3. **Maker's plate:** the mark at 18–20 px with KOBIKLANG in spaced capitals, in the footer or on the device's surface, like a manufacturer's badge.
4. **Version and licence:** at the very bottom, "KobiKlang · <tool> v<version> · Licence <number>". Both come from one `about.js` file in the tool, and the version matches its `package.json`. Licence numbers run KK-<tool code>-<4-digit copy number>, e.g. KK-SB-0001 for copy 1 of Show Builder.

## Writing in the GUI

Write on-screen text the way an engineer would say it at the desk: short, plain, active. "Put the desk IP in first", not "Please enter the desk IP address". Name things by what people see (inputs, outputs, sockets), not how the code works (zones, commands, banks). No exclamation marks, no "Please", no "Successfully".
