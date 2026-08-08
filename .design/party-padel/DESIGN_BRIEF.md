# Design Brief: Party Padel

Source: `Party_Padel_Brand_Guidelines_Website_Brief.docx` (client-supplied, v1.0), imported verbatim below. This is the authoritative brand and product spec — it supersedes earlier informal direction taken from Instagram references.

> **Amendment — 8 August 2026 (from the brand owner):** Party Padel is **not a league** — it's a one-night event, per city. Quick-format padel competition, a cash prize for the winning team(s), and a complete party built around it: activations, DJs, fun. The verbatim brief below still uses "league" language in places (brand proposition, example taglines) — treat those as superseded by this note. The underlying event mechanics (group fixtures into a same-night final) were already correct; only the "league" framing needs to go from new copy.

---

## 1. Brand Foundation

**Brand name:** PARTY PADEL

**Brand proposition:** Party Padel turns competitive padel into a high-energy live event. Short-format doubles leagues, DJs, lighting, walk-ons, social spaces and finals production combine the accessibility of club padel with the atmosphere of a major sporting event.

**Positioning:** Not a padel club. Not a traditional tournament. Not a nightclub with courts. Party Padel sits between competitive social sport and live entertainment.

**Brand promise:** Every player should feel like an athlete. Every spectator should feel like they are at an event worth attending.

**Core audience:**
- Primary: socially active 20–40 year olds who already play padel, racket sports, gym/fitness or social sport.
- Secondary: friends, partners and spectators attracted by music, nightlife, competition and social content.
- Commercial: premium sport, fitness, apparel, automotive, technology, beverage, lifestyle and financial-service partners.

**Brand personality:** Competitive, not intimidating. Premium, not corporate. Energetic, not childish. Social, not gimmicky. Confident, not arrogant. Night-time, but still unmistakably sport.

## 2. Visual Identity

**Primary wordmark:** Stacked two-line PARTY / PADEL wordmark. PARTY is the hero word in acid chartreuse. PADEL is white. Both words form a strong rectangular block with near-identical optical width. **Upright — not italicised/skewed.**

**Signature court-line device:** Thin geometric lines derived from a simplified top-down padel court cut through the letterforms as negative-space interruptions, not illustrations — discovered on a second look, not the first thing you notice.
- Restrained horizontal court line across the wordmark.
- Central vertical court line where compositionally appropriate.
- Additional service-line cuts sparingly.
- Never a drawn racket, ball, net mesh or miniature court inside letters.
- Court-line weight substantially thinner than letter strokes.

**Secondary mark:** PP monogram for avatars/favicon/compact placements, derived from the same geometry. Until a final vector PP is approved, the stacked wordmark remains authoritative.

**Clear space / min size:** Clear space ≥ height of the P's horizontal crossbar. Don't crowd with sponsor logos, nav or photography. At small sizes, drop court-line detail if it hurts legibility; use the PP mark at favicon scale rather than compressing the full wordmark.

**Logo delivery:** supplied as image/SVG asset — not recreated as HTML/CSS lettering.

## 3. Colour System

Predominantly black. Acid is an accent, not a background wash. **No gradients, no neon glows, no rainbow nightclub colour.** White = clarity, acid = recognition.

| Colour | Hex | Role | Usage |
|---|---|---|---|
| Party Acid | `#DFFF00` | Primary accent | PARTY wordmark, CTAs, active states, court lines, key data |
| Event Black | `#090909` | Primary background | Website, signage, social, apparel |
| Clean White | `#FFFFFF` | Primary neutral | PADEL wordmark, headlines, body copy on dark |
| Concrete Grey | `#B9B9B9` | Secondary neutral | Metadata, secondary copy, disabled states |
| Carbon | `#171717` | Raised surface | Cards, panels, subtle UI separation |

## 4. Typography

Heavyweight condensed/semi-condensed grotesk, strong rectangular proportions — contemporary sport/fashion, not esports or motorsport. Avoid excessive italics, sci-fi cuts, novelty stencil fonts.

- Digital: commercially-safe webfont with a close character — bold condensed display for headlines, clean grotesk for body/UI. Implement via CSS variables so the licensed brand font can be swapped later without rebuilding layouts.
- Headlines: uppercase by default, tight tracking, heavy weight.
- Body: sentence case, highly readable, normal tracking.
- Stats/scores: tabular numerals where available.
- Avoid long paragraphs in all caps.

## 5. Photography & Art Direction

Dark warehouse/premium indoor-club environments. Hard directional lighting, practical fixtures, controlled haze. Real sweat, movement, reactions, imperfect moments — not sterile stock. Aspirational but attainable players, not exclusively pro athletes. Crowds close to the action, DJs, social zones, celebrations alongside sport. Black/charcoal/neutral environments so acid branding stays dominant. Avoid generic sunny resort padel, pastel lifestyle imagery, obvious AI-perfect faces.

## 6. Graphic Language

**Court lines** are the master graphic device — extend beyond the logo into layouts, photography, scorecards, fixtures, transitions. Architectural grid, not decorative scribbles.

**Motion:** Court lines draw on, intersect, reveal content. Fast cuts for event content, restrained motion for core UI. Logo animation: geometry appears first, then resolves into the wordmark. No generic glitch effects, excessive glow, gaming-style particles.

**UI shapes:** Corners mostly square or subtly rounded. Avoid large pill-shaped interfaces except compact filters/tags. Buttons solid, wide, decisive.

## 7. Tone of Voice

Confident modern sports property — not a corporate federation, not a nightclub promoter. Short and direct. Competitive without macho clichés. British English. Energetic without constant exclamation marks. Culture/nightlife references used selectively. Never over-explain padel to an audience already interested.

Example language: "THE COURT AFTER DARK." / "YOUR TEAM. YOUR CITY. YOUR NIGHT." / "20 MINUTES. NO HIDING." / "PLAY HARD. STAY LATE." / ~~"ENTER THE LEAGUE."~~ *(superseded — see amendment above; use "ENTER THE EVENT" or similar)* / "FROM FIRST SERVE TO FINAL SET."

## 8. Event Product

**Core competition:** Teams of two. Launch model: three divisions (Men's, Women's, Mixed). Working target: 50 teams / 100 players per event, short match slots, finals programme that gets more theatrical as the day progresses.

**Experience pillars:** Competition (fixtures, standings, progression, finals) · Production (DJ, MC, lighting, walk-ons, feature court, score presentation) · Social (food, drink, viewing, friends, dwell time) · Content (every event generates material to sell the next) · Partnership (sponsor integrations improve the event, don't clutter it).

## 9. Website Strategy

**Objective (in order):** team registrations → spectator tickets → commercial/venue enquiries. Feel like entering the event, not reading a brochure.

**Primary nav:** EVENTS · PLAY · FORMAT · RESULTS · PARTNERS · ABOUT
**Persistent primary CTA:** ENTER A TEAM. **Secondary CTA when events are live:** GET TICKETS.

**Homepage structure:**
1. Hero — full-bleed event film/image, master logo, city/date, ENTER A TEAM CTA.
2. Next events — city cards: date, venue, registration status, ticket CTA.
3. The format — short-format padel explained in 3–4 visual steps.
4. Divisions — Men's / Women's / Mixed.
5. The experience — sport, DJ, lighting, crowd, feature court.
6. Live standings/results teaser — competition credibility.
7. Brand/partner strip — only once real partners are confirmed.
8. Social proof/content wall — high-energy event imagery, short-form video.
9. Final CTA — build your team / enter the next event.
10. Footer — contact, socials, policies, partner enquiries.

**Event detail page:** city + date + venue hero · registration status + spaces remaining · team entry price · division availability · event schedule · competition rules/scoring · venue/access info · spectator tickets · FAQ · sticky "Enter a Team" CTA on mobile.

**Registration journey:** Step 1 event + division → Step 2 team name + two player details → Step 3 payment → Step 4 confirmation with shareable team card. No account creation before payment unless technically essential. Keep it extremely short.

## 10. Website Visual Spec

- Desktop: immersive full-width, generous negative space, oversized type. Mobile: mobile-first, CTA always reachable, never mechanically shrink desktop layouts.
- Background: Event Black `#090909`. Primary text: white. Secondary text: Concrete Grey.
- Accent/interactive: Party Acid `#DFFF00`.
- Court-line geometry as dividers, hover reveals, section framing, image masks.
- **No generic gradients. No glassmorphism. No glowing neon buttons.**
- Cards use Carbon `#171717` only where grouping is necessary.
- Photography bleeds to edges, cropped dynamically.
- Buttons: uppercase, heavy, high contrast — acid primary button with black text.
- Hover states: line movement, inversion or controlled acid highlight — **not glow.**
- Score/fixture UI resembles premium broadcast graphics, not spreadsheet tables.
- Accessibility: WCAG contrast, keyboard nav, visible focus states, reduced-motion support, descriptive alt text.

## 11. Suggested Components

HeroEvent · EventCard · DivisionCard · FormatSteps · FixtureBoard · StandingsTable · TeamCard · FinalsBracket · ExperienceGallery · PartnerBand · CTASection · FAQAccordion

## 12. Build Instructions (direct)

Prioritise conversion to team registration. Semantic HTML, reusable components. CSS design tokens for colour/type/spacing/radii/line-weight. Placeholder assets cleanly labelled. Do not invent sponsor logos or partner claims. No lorem ipsum — write real Party Padel copy in the defined tone. Responsive desktop/tablet/mobile. Accessible focus/hover, reduced-motion. Logo as image/SVG asset, not HTML lettering. Fixtures/standings/brackets as first-class components. Event status states: Coming Soon / Entries Open / Limited / Sold Out / Completed. Structure event data so new UK cities can be added without redesigning pages.

## 13. Do / Don't

| Do | Don't |
|---|---|
| Let the wordmark dominate. | Add rackets, balls or cartoon padel imagery to the logo. |
| Use acid sparingly for hierarchy. | Cover whole pages in fluorescent colour. |
| Use real, energetic event photography. | Use generic corporate sports stock. |
| Extend court lines through layouts. | Turn every section into a literal court diagram. |
| Keep copy short and confident. | Use nightclub clichés or forced slang. |
| Make registration obvious. | Hide conversion behind menus or account creation. |

## 14. Brand North Star

**SERIOUS SPORT. SOCIAL ENERGY.**

If a design decision makes Party Padel look like a normal padel club, remove it. If it makes the competition feel fake or secondary to the party, remove it. The identity works when both sides feel equally credible.

---

## Assets on hand

- `assets/img/logo-lockup.png` — primary stacked wordmark on black (source: client upload, square 1:1 crop).
- `assets/img/brand-board.png` — full moodboard reference (lockup variants, PP monogram, court/jersey/poster/LED mockups) — reference only, not a usable asset.
- No vector/SVG logo or PP monogram file supplied yet. Treat the raster lockup as the interim logo asset per brief §2; swap for vector when supplied.
