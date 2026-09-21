# The Great British Cheese Festival

A fast, mobile-first festival website built for one job: get someone from
"what's this?" to a bought ticket in as few taps as possible. Static
site, no build step, no framework — deploy by uploading files anywhere
(GitHub Pages, Netlify, Cloudflare Pages, or plain FTP).

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero with dates/facts, what's on, ticket teaser, stallholder CTA, FAQ |
| `tickets.html` | The buying page — day tickets, weekend pass, VIP, one click to checkout |
| `vendors.html` | Stallholder pitch info + application form |
| `about.html` | Festival story and numbers |
| `contact.html` | Contact form + direct emails |
| `privacy.html` | Privacy & cookies policy |

## Structure

```
assets/css/tokens.css   Every colour/type/spacing/radius value used anywhere
assets/css/style.css    Component styles, all referencing tokens.css
assets/js/main.js       Mobile nav, FAQ accordion, scroll-reveal
```

Run locally with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Wiring up real ticket sales

Every "Buy tickets" button on `tickets.html` has an `href="#"` placeholder
and a `data-buy="..."` attribute so you can find it easily. Replace each
`href="#"` with that ticket's checkout URL from your ticketing platform
(Ticket Tailor, Eventbrite, Fixr, etc.) — one link per date/ticket type.
That's it: no backend, no card data ever touches this site, the visitor is
sent straight to your ticketing platform's hosted checkout in one click.

The homepage's "Buy Tickets" buttons link to `tickets.html` itself, which
is where the actual per-date checkout links live — keeping the homepage
free of stale links if dates or prices change.

## Newsletter sign-up

The sign-up block lives on the homepage (`#signup`) and collects a first name,
an email and an explicit marketing consent tick. It validates in the browser
first — missing name, malformed email, unticked consent — before anything is
sent.

**It is not connected to anything yet.** The `<form>` has an empty `action`,
and while that's the case JavaScript shows the success state in place instead
of submitting. Nothing is stored. Wire it up one of two ways:

1. **Mailchimp / Brevo / Mailerlite** — paste their form endpoint into the
   `action` attribute. The fields are already named `FNAME` and `EMAIL`, which
   is what Mailchimp expects. Once `action` is set the JS stops intercepting
   and the provider handles the submission and confirmation.
2. **A WordPress plugin** — delete the `<form>` and drop in the shortcode from
   Mailchimp for WordPress, Fluent Forms, WPForms or similar. Keep the
   surrounding `<section class="signup">` markup so the styling still applies.

Either way the consent tick is deliberately its own checkbox, unticked by
default, and separate from the line about storing details — that's what UK
ICO guidance expects for marketing consent. Don't pre-tick it or merge the two.

## Putting this on WordPress

**Done — it's packaged.** `wp-theme/gbcf-theme.zip` is a complete WordPress
theme carrying this exact design.

In WordPress: **Appearance → Themes → Add New → Upload Theme**, choose that
zip, Install, Activate. Then create five empty pages with the slugs
`tickets`, `vendors`, `about`, `contact`, `privacy`, set a static homepage
under **Settings → Reading**, and set permalinks to **Post name**. Full
instructions are in `wp-theme/gbcf/README.txt`, which ships inside the zip.

How it is put together:

| File | What it is |
|---|---|
| `header.php` / `footer.php` | The chrome every page shares — head, sticky header, bunting; footer and booking bar |
| `front-page.php` | The homepage |
| `page-tickets.php` and friends | One per page, attached automatically by slug |
| `page.php` / `index.php` / `404.php` | Fallbacks, so anything the team adds later still gets the design |
| `functions.php` | Enqueues the fonts, tokens, stylesheet and script |
| `inc/ink-sprite.svg` | The hand-drawn illustrations, inlined once per page |
| `assets/` | Unchanged from the static site — same CSS, JS and images |

Rebuild the zip after any change to the static site by re-running the
packaging step, or edit the theme in `wp-theme/gbcf/` directly and re-zip:

```bash
cd wp-theme && zip -rq gbcf-theme.zip gbcf
```

The static site in the repo root still works on its own, so you can keep
previewing changes without WordPress in the way.

## Adding the logo

Every page's header and footer already reference `assets/img/logo.png`.
That file isn't in the repo yet — until it is, the header falls back to the
type-only lockup and the footer mark stays hidden (no broken images either
way). To switch the real logo on, add the file at exactly that path:

```
assets/img/logo.png
```

The quickest route is GitHub's web uploader: open the repo on the branch,
go to `assets/img/`, then **Add file → Upload files**. A transparent PNG or
an SVG works best; if you use SVG, save it as `logo.svg` and update the two
`src="assets/img/logo.png"` references per page. The footer inverts the mark
to white automatically, so a black-on-transparent version covers both places.

## Editing content

- **Colours/type/spacing**: `assets/css/tokens.css` — nothing else should
  have a hardcoded value. The palette (cream, cheddar-orange, plum) and
  fonts (Fraunces for headings, Inter for body) can be swapped here to
  rebrand without touching any page.
- **Copy, dates, prices**: written directly in each page's HTML.
- **Forms**: the stallholder application (`vendors.html`) and contact form
  (`contact.html`) currently just show a client-side success message —
  wire them up to a form backend (Formspree, Netlify Forms, or your own
  endpoint) by pointing the `<form>` at it before launch.

## Deploying

Plain static site — deploys anywhere. Upload everything in this folder;
there's no build step and no server-side code to configure.
