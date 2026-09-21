<?php
/**
 * About — Applies automatically to the page with the slug 'about'.
 *
 * The markup below is the design as built. Edit the copy here, or move a
 * block into the WordPress editor if the team needs to change it themselves.
 *
 * @package GBCF
 */
get_header();
?>


  <section class="page-hero">
    <div class="container">
      <span class="label">About</span>
      <h1>Savour the flavours of Britain.</h1>
      <p>A weekend built around craftsmanship, community and indulgence — and around the people who actually make British cheese.</p>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div class="split" data-reveal>
        <div class="split-media">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/hero-cheese-stall.jpg" alt="A long table laid with boards of British cheese under a marquee" loading="lazy">
        </div>
        <div class="split-body">
          <span class="label">The festival</span>
          <h2>Two days, two different moods.</h2>
          <p>Saturday is the family day: funfair rides, fete games, cooking demonstrations and live music from legacy and chart-topping bands, running into a late-evening party.</p>
          <p>Sunday turns traditional. A full philharmonic orchestra takes the stage with leading singers through the evening, closing on a grand spectacle. Both days open with the farmers market at ten.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="band" style="background-image:url('assets/img/cheese-display.jpg')">
    <div class="container" data-reveal>
      <span class="label label-light">On the ground</span>
      <h2>Everything within a short walk.</h2>
      <p>Sampling zones of traditional and contemporary British cheese, breads and chutneys. Live cheesemaking, pairing sessions and masterclasses. Mini-farm experiences and children's tasting areas. Musicians and street performers throughout.</p>
    </div>
  </section>

  <section>
    <div class="container">
      <div data-reveal style="max-width: 46ch; margin-bottom: var(--space-lg);">
        <span class="label">By the numbers</span>
        <h2>What to expect.</h2>
      </div>
      <div class="stats" data-reveal>
        <div class="stat"><strong>5–6k</strong><span>Visitors across the weekend</span></div>
        <div class="stat"><strong>60+</strong><span>Artisan traders</span></div>
        <div class="stat"><strong>250</strong><span>Cheeses to taste</span></div>
        <div class="stat"><strong>3k</strong><span>Picnic &amp; seating capacity</span></div>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div class="split reverse" data-reveal>
        <div class="split-media wide">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/friends-laughing.jpg" alt="Friends enjoying drinks together at the festival" loading="lazy">
        </div>
        <div class="split-body">
          <span class="label">Tickets</span>
          <h2>Come and taste it.</h2>
          <p>Day tickets from £15, weekend passes from £25, and VIP with lounge access and a guided pairing session.</p>
          <a href="<?php echo esc_url( home_url( '/tickets/' ) ); ?>" class="btn btn-primary">Book tickets</a>
        </div>
      </div>
    </div>
  </section>

<?php
get_footer();
