# Scribble Labs

Scribble Labs is the maker's name for my live-sound tools and plug-ins. The name comes from a desk's scribble strip, the little name display above each fader, which is what these tools write to.

## Files

| File | Use |
|---|---|
| `scribble-labs-mark.svg` | The mark on its own: app icons, favicons, the maker's plate on a device |
| `scribble-labs-logo.svg` | Mark and wordmark, for light backgrounds |
| `scribble-labs-logo-dark.svg` | Mark and wordmark, for dark backgrounds |

## The mark

A scribble strip (amber, with a hand-drawn line) above three faders set at different levels, on a dark rounded tile. It stays readable down to 16 px.

## Colours

| Name | Hex | Where |
|---|---|---|
| Console black | `#16191D` | Tile, wordmark on light |
| Strip amber | `#FFB020` | Scribble strip |
| Fader cap | `#E9EDF1` | Caps, wordmark on dark |
| Slot grey | `#454C55` | Fader slots |
| Label grey | `#7A838E` (light) / `#9AA3AD` (dark) | "LABS" |

## GUI colour

Every Scribble Labs plugin uses **strip amber `#FFB020`** as its interface accent: primary buttons, selected and "on" states, toggles, checkboxes, progress bars and focus rings. Don't use any other accent colour.

- **Text on amber:** console black `#16191D`.
- **Amber as text on a light background:** use `#9A5B00`, because amber text on white is too faint to read. On dark backgrounds, plain `#FFB020` is fine.
- **Warnings:** orange (`#B4430A` light, `#FF8A4C` dark), so they never look like the accent.
- **Starting point:** `scribble-labs.css` has these as ready-made tokens.

## Type

The wordmark is set in **Barlow Condensed** (Google Fonts, free): Bold for SCRIBBLE, Regular for LABS, uppercase with slight letter-spacing. The SVGs fall back to Arial Narrow where Barlow Condensed isn't installed. For print or signage, open the logo in a vector editor with Barlow Condensed installed and convert the text to outlines.

## Stamping a tool

Every Scribble Labs tool carries the brand in three places:

1. **Header:** the mark at 28 px, then "Scribble Labs · <tool name>" as the small line above the title.
2. **Browser tab:** `scribble-labs-mark.svg` as the favicon.
3. **Maker's plate:** the mark at 18–20 px with SCRIBBLE LABS in spaced capitals, in the footer or on the device's surface, like a manufacturer's badge.
4. **Version and licence:** at the very bottom, "Scribble Labs · <tool> v<version> · Licence <number>". Both come from one `about.js` file in the tool, and the version matches its `package.json`. Licence numbers run SL-<tool code>-<4-digit copy number>, e.g. SL-SB-0001 for copy 1 of Show Builder.

## Writing in the GUI

Write on-screen text the way an engineer would say it at the desk: short, plain, active. "Put the desk IP in first", not "Please enter the desk IP address". Name things by what people see (inputs, outputs, sockets), not how the code works (zones, commands, banks). No exclamation marks, no "Please", no "Successfully".
