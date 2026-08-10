# Beauport — Brand Guidelines

Private, in-person concierge for corporate principals and private clients,
based in Jersey.

---

## 1. Positioning

**One line:** Beauport is a private concierge, based in Jersey, built around
people rather than an app — for corporate principals, family offices and
private clients who already trust the island with their affairs and now
want it to handle the rest.

**The gap this fills:** Velocity Black and its peers (Quintessentially,
John Paul, etc.) are app-first — a chat window and a global network of
partners you never meet. That works for restaurant tables and flight
upgrades. It works less well for the things Jersey's actual client base
needs most: a relocating CFO who needs a house, a school place and a
trust structure to line up in the same quarter; a fund's LPs flying in
for an AGM who need the whole week handled, not just the dinner
reservation; a family office principal who wants to speak to the same
person every time, not a rotating support queue.

Jersey's economy is built on discretion and personal relationships —
private banking, trusts, funds. Beauport applies that same operating
model to lifestyle and logistics: a small number of named account
managers, physically on the island and reachable in the cities clients
actually move through (London, Geneva, Paris, Monaco), who do the work
themselves rather than dispatching it to a directory.

**Positioning statement:**
> Beauport is a private, in-person concierge for corporate principals and
> private clients connected to Jersey — extending the discretion of
> private banking into everyday life, on and off the island.

## 2. Audience

- **Corporate** — fund managers, trustees and family offices coordinating
  board meetings, AGMs, LP visits and staff relocation to Jersey.
- **Private clients** — principals and their families, often already
  Jersey-resident or Jersey-connected through a trust or fund structure,
  who want one point of contact for travel, property, education,
  household staff and access, in Jersey and in the cities they split
  their time with.

Both groups arrive by introduction — from a bank, a trust company, a law
firm, or an existing client. Beauport is not a consumer app and does not
run open sign-up.

## 3. The name

**Beauport.** Two things it carries at once, deliberately:

1. **A real place, not an invented word.** Beauport is an actual bay on
   Jersey's south coast — quiet, exclusive, largely private frontage.
   Naming the business after a specific, real piece of the island (rather
   than a generic "coastal" word) signals that Beauport actually knows
   Jersey, the way a client's own advisers do.
2. **What it means.** French for "beautiful harbour" — a literal
   translation that reads as effortlessly upmarket in English without
   needing explanation, and echoes the register of "beau"/"Beaufort"
   without borrowing either.

Full name for legal/formal use: **Beauport Concierge**. "Beauport" alone
carries the wordmark, signage and everyday reference.

Say it as the French-Jersey pronunciation, roughly **"boh-por"** — not
anglicised to "bow-port," and never abbreviated.

## 4. Personality & voice

Beauport is **understated, precise, and unhurried.** It sounds like the
private banker who already knows the answer and doesn't need to prove it.

**Is:**
- Declarative. Short sentences that state a fact plainly.
- Specific. "A table at Core by Clare Smyth on the night you land" beats
  "world-class dining experiences."
- Quiet about access. It never boasts about who it knows.

**Is not:**
- Exclamatory. No exclamation marks, ever.
- Hyped. No "unlock," "elevate," "curated experiences," "bucket list."
- Apologetic or eager. Never "we'd love to," always "we will."

**Reference points:** a private bank's client letter, a Savile Row
tailor's fitting note, a well-run family office's internal memo. **Not:**
an airline lounge ad, a fintech app's onboarding copy, a super-yacht
brochure.

**Sample lines:**
- "By introduction only."
- "One point of contact, on the island and off it."
- "We handle it before you have to ask."
- "Available to principals and their families, in Jersey, London,
  Geneva and Paris."

## 5. Visual identity — coastal minimal

The visual system draws on Jersey's actual coastline and light, not
generic luxury signifiers (no gold leaf, no crests, no superyacht stock
photography). It should feel closer to a well-made shipping forecast
than a five-star hotel brochure.

### Colour palette

| Token | Hex | Use |
|---|---|---|
| Paper | `#F5F3EE` | Primary background — warm off-white, not clinical white |
| Ink | `#171B1E` | Primary text, near-black with a hint of granite blue |
| Granite | `#585F63` | Secondary text, captions |
| Granite Line | `#D9D5CB` | Hairline rules, borders, dividers |
| Marine | `#0E3A52` | Single accent — links, CTAs, the tide-line motif |
| Marine Deep | `#0A2839` | Marine hover/active state, dark section backgrounds |
| Brass (sparing) | `#A9895F` | Reserved for the monogram mark and one hairline per page, maximum. Never a fill colour. |

Rule: **one accent colour per screen.** Marine does the work; brass is a
single flourish, not a second palette. No gradients except the horizon
treatment described below.

### Typography

- **Display / headings — Fraunces.** A serif with enough contrast to
  read as considered rather than corporate; used at large sizes, tight
  tracking, sentence case (never all-caps for long headlines).
- **Body / UI — Inter.** Carries paragraphs, navigation, forms, labels.
  All-caps is reserved for short labels (nav items, eyebrows) at wide
  letter-spacing, never for body copy.
- **Scale:** headlines set large with generous line-height; body copy
  never smaller than 16px; captions/labels at 13px with +0.08em
  tracking.

### The tide line

The recurring motif is a **single thin horizontal rule** — the tide
line / horizon — used to divide sections, underline the wordmark, and
mark transitions. It stands in for wave/anchor/compass iconography,
which the brand deliberately avoids as overused in coastal branding.
Rendered in Granite Line by default, Marine or Brass only at moments of
emphasis (e.g. under the logo).

### Motion

Motion is what separates "quiet luxury" from "budget minimalism" —
it's where the brand signals that real craft went into the build, which
is what earns trust from both an old-money principal (who reads
restraint as confidence) and a younger corporate client (who reads
engineering polish as competence). The rule throughout: **one
orchestrated moment, not scattered effects.**

- **Ease.** A single unhurried curve (`cubic-bezier(0.16, 1, 0.3, 1)`)
  used everywhere something moves — an instrument settling into place,
  never a UI snapping shut.
- **The hero loads once, deliberately.** Headline, image and CTA rise
  into place in a fixed sequence on page load — not on scroll, not
  looping. It happens once, like a case opening.
- **The instrument dial.** A large, quiet watch-bezel motif sits behind
  the homepage headline — thin ticks, cardinal points, a fixed brass
  needle. The tick ring turns once every 3.5 minutes; imperceptible
  moment to moment, alive if you actually watch it. Decorative only —
  it never carries real navigational data.
- **The tide rises, not snaps.** Button and link states fill from the
  bottom rather than swapping colour outright, echoing the brand's own
  tide-line motif rather than a generic hover state.
- **Dividers draw themselves in.** A tide-line rule animates from 0 to
  full width as it enters view, like an instrument taking a reading —
  used once per page transition, never on every rule.
- **Parallax is a whisper.** Horizon panels drift a few pixels against
  scroll — enough to read as dimensional, never enough to distract.
- **Always respects `prefers-reduced-motion`.** Every animation above
  has a static fallback; content is never gated behind motion completing.

### Logo

Wordmark-only, no crest or icon on the primary lockup:

```
B E A U P O R T
――――――――――――――――
CONCIERGE
```

"BEAUPORT" in Fraunces, tracked out, sentence case in UI contexts,
small-caps/tracked-caps acceptable in the static lockup only. A single
Marine hairline (the tide line) sits between wordmark and the
"CONCIERGE" line, set in Inter, tight tracking, small.

**Monogram** (favicon, social avatar only): a single serif "B" centred
inside a thin circular ring — the ring reads as a tide ring rather than
a crest. Never used as a replacement for the wordmark on the website or
stationery; monogram is for small-format contexts only.

### Imagery

- Horizon lines, granite textures, still water, low winter light —
  Jersey's coast, not a generic tropical concierge look.
  This build ships **without photography** rather than stock or
  fabricated imagery: gradients and granite-texture panels stand in
  until real commissioned photography exists. Never use stock photos of
  unrelated locations, unnamed "clients," or generic yacht/jet imagery
  presented as Beauport's own.
- No people in imagery unless they are real, named, and have consented —
  the brand does not fabricate a clientele.

## 6. Do / Don't

**Do**
- Let whitespace and the tide line do the separating; avoid boxes and
  drop shadows.
- Write specific, checkable claims only ("on the island," "by
  introduction") — nothing that implies scale or access the business
  doesn't yet have.
- Keep every page's CTA the same verb: **Request an introduction.**

**Don't**
- Don't use exclamation marks, emoji, or countdown/urgency language.
- Don't show client logos, testimonials, or "as featured in" press
  marks unless they are real and cleared.
- Don't introduce a second accent colour, a gradient background, or
  wave/anchor iconography.
- Don't call it an "app" or "platform" — Beauport is a service, reached
  by phone, email and in person, not a product to download.

## 7. Applications built in this pass

- `beauport/index.html` — home
- `beauport/services.html` — corporate, private client and access
  services
- `beauport/philosophy.html` — why in-person, why Jersey
- `beauport/membership.html` — introduction/enquiry (client-side form,
  no backend — matches this repo's existing pattern on
  `partners.html`)

See `README.md` inside `beauport/` for structure and how to extend it.
