# Wilderwood Festival — site

A static marketing site for **Wilderwood Festival**, a fictional 12,000-capacity
boutique UK festival (Thu 26 – Mon 30 August 2027, Ashmere Park,
Northamptonshire).

Built as a design exercise "in the spirit of" the UK boutique-festival genre —
bank-holiday weekend, many stages, woodland, ethics and sustainability front and
centre. **Wilderwood is invented.** No real festival's name, branding, copy,
artwork or artist bookings are used anywhere in it, and nothing on the site takes
a payment.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Hero, what-it-is, the six areas, line-up teaser, green story, get-involved, news, newsletter |
| `line-up.html` | Line-up by day (Thu–Sun) with a day filter, plus the non-music programme |
| `tickets.html` | Ticket tiers, Green Traveller, payment plan, ticket FAQs |
| `info.html` | Gates and dates, travel, accessibility, what to bring, FAQs, contact |
| `get-involved.html` | Volunteer, perform, trade, paid crew |
| `green.html` | Sustainability story, the five things that moved the number, what's unsolved |

## Structure

```
assets/css/tokens.css   Every colour, type size, space, radius, shadow and
                        motion value, for both light and dark themes
assets/css/style.css    Components, all referencing tokens.css — no hardcoded
                        colours
assets/js/main.js       Theme toggle, mobile drawer, scroll reveal, accordion,
                        line-up day tabs, demo form handling
```

No build step, no framework, no dependencies. Upload the folder and it works.
Fonts (Caprasimo, Fraunces, DM Sans) load from Google Fonts.

## Design direction

Folk-psychedelic riso print: warm oat paper, terracotta / marigold / deep-teal /
plum inks, chunky display type (Caprasimo) against a wonky variable serif
(Fraunces), hard offset shadows instead of soft ones, an SVG paper-grain overlay,
and CSS-drawn decoration — a rotating hero sunburst, scalloped dividers, bunting,
and gradient "blobs" standing in for photography.

Colour discipline worth knowing before you edit:

- `--c-accent` and friends are the **fill** hues (buttons, bunting, blobs).
- `--c-accent-ink` is the **text** hue — a deeper rust, because terracotta at
  13px on oat paper fails WCAG AA.
- `--fill-*-bg` / `--fill-*-fg` are background/foreground **pairs** for filled
  controls, so they can flip independently per theme.
- `--c-ink-accent` / `--c-ink-muted` / `--c-ink-rule` are for surfaces that
  invert between themes (`.section--ink`, the footer): in dark mode those
  surfaces become pale, so a light accent on them would fail.

All text on all six pages, in both themes, passes WCAG AA contrast (verified by
sampling computed styles in a headless browser). Dark mode responds to both
`prefers-color-scheme` and a manual toggle stored in `localStorage`, and all
motion is disabled under `prefers-reduced-motion`.

## Editing

Each page carries its own copy of the header, drawer and footer — same as the
rest of this repo, and the price of having no build step. Change the nav or
footer and you change it in all six files.

## Things a real deployment would need

- Replace the CSS gradient "blobs" with real photography
- Wire the newsletter and application forms to a provider (they are inert)
- A real ticketing integration, news/journal pages, an interactive site map,
  `robots.txt` and a sitemap
