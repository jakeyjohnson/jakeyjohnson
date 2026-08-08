# PartyPadel.UK

Marketing website for PartyPadel.UK — social padel tournaments with live DJs
and afterparties, hosted at partner venues across the UK.

## What's here

A static, single-page site (no build step, no framework) designed to look and
feel like modern sport/event brands (HYROX, Spartan Race, Tough Mudder):
dark theme, bold type, animated hero, scroll reveals, and a working sign-up
flow, built specifically to appeal to three audiences at once:

- **Players** — hero, "how it works", events grid, testimonials
- **Sponsors** — `#sponsors` section with audience stats and a "Become a Sponsor" CTA
- **Venues** — `#venues` section with revenue/utilisation stats and a "List Your Venue" CTA

All three funnel into one sign-up form (`#signup`) with a role selector
(Player / Sponsor / Venue).

## Structure

```
index.html              All page markup/sections
assets/css/style.css     Design system, layout, animations
assets/js/main.js        Scroll reveals, animated counters, particle canvas
                          backgrounds, confetti burst, FAQ accordion, form logic
```

No dependencies, no package.json, no build tools — just open `index.html` or
serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Wiring up the sign-up form for real

The form in `assets/js/main.js` (`#signupForm` submit handler) currently
validates client-side and shows a success/confetti state, but doesn't send
data anywhere — there's a clear `NOTE:` comment marking where to plug in a
real backend. Easiest options:

- **Formspree / Getform** — point the `<form>` at their endpoint and `fetch()`
  it in the submit handler instead of the `setTimeout` stub.
- **Mailchimp / Klaviyo** — post to their signup API or embed their form
  action URL.
- **Netlify Forms** — if hosting on Netlify, add `data-netlify="true"` and a
  hidden `form-name` input to the `<form>` tag; Netlify handles the rest.
- **Your own API** — replace the stub with a `fetch('/api/signup', {...})` call.

## Editing content

- **Events**: duplicate an `.event-card` block in `index.html` under `#events`.
- **Stats**: change `data-target` (and optional `data-suffix`) on any
  `.stat-num` element — the counter animation reads those attributes.
- **Colours/fonts**: all design tokens are CSS custom properties at the top
  of `assets/css/style.css` (`:root { --pink, --orange, --lime, --cyan ... }`).

## Deploying

This is a plain static site, so it deploys anywhere: GitHub Pages, Netlify,
Vercel, Cloudflare Pages, or any web host — just upload the three files/folders
above.
