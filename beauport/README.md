# Beauport

Private concierge for corporate and private clients connected to Jersey.
Static, multi-page site, no build step, no framework, no backend — built
against `.design/beauport/BRAND_GUIDELINES.md`.

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Home — positioning, three service pillars, reach, CTA |
| `services.html` | Corporate / private client / access services, in detail |
| `philosophy.html` | Why in-person, why Jersey |
| `membership.html` | Introduction/enquiry — client-side form only, no backend |

## Structure

```
assets/css/tokens.css   Design tokens — every colour/type/spacing value
                         used anywhere on the site
assets/css/style.css    Component styles, all referencing tokens.css
assets/js/main.js       Nav toggle, scroll-reveal, enquiry form validation
```

Run locally with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/beauport/
```

## Placeholders to swap before launch

- **Email** — `principal@beauportconcierge.com` throughout is a
  placeholder; swap for the real domain/inbox.
- **Imagery** — the `.horizon` panels are CSS gradients standing in for
  commissioned photography (see brand guidelines §5 — no stock photos of
  unrelated locations or people).
- **Enquiry form** — validates and shows a success state client-side
  only; wire it to a real inbox or form service (e.g. Formspree, a
  serverless function) before launch. Same pattern as `partners.html` on
  the Party Padel site in this repo.
- **Legal pages** — footer Privacy/Terms links are placeholders (`#`).

## Brand guidelines

Full brand guidelines — positioning, naming rationale, voice, colour
palette, typography, logo concept, do's/don'ts — live in
`.design/beauport/BRAND_GUIDELINES.md`.
