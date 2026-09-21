<?php
/**
 * Home — Front page.
 *
 * The markup below is the design as built. Edit the copy here, or move a
 * block into the WordPress editor if the team needs to change it themselves.
 *
 * @package GBCF
 */
get_header();
?>


  <section class="hero" style="background-image:url('assets/img/mascot-crowd.jpg')">
    <div class="container">
      <div class="hero-inner">
        <div class="hero-meta">
          <span>Sat 5 &amp; Sun 6 June 2027</span>
          <span>Venue announced soon</span>
        </div>
        <h1>Savour the flavours of Britain.</h1>
        <p>Two days of British cheese, cider and live music. 60+ makers, 250 cheeses to taste, and a philharmonic Proms to close.</p>
        <div class="hero-actions">
          <a href="#tickets" class="btn btn-light">Book tickets — from £15</a>
          <a href="#whats-on" class="btn btn-outline-light">What's on</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Practical answers first: what, when, where, how much. -->
  <section class="section-tight">
    <div class="container">
      <div class="essentials" data-reveal>
        <div class="essential">
          <svg class="ink ink-essential" aria-hidden="true"><use href="#ink-wheat"></use></svg>
          <span class="k">When</span>
          <span class="v">Sat 5 &amp; Sun 6 June 2027</span>
          <span class="sub">Market 10:00 · Main event 14:00–21:30</span>
        </div>
        <div class="essential">
          <svg class="ink ink-essential" aria-hidden="true"><use href="#ink-tent"></use></svg>
          <span class="k">Where</span>
          <span class="v">Announced soon</span>
          <span class="sub">Free on-site parking</span>
        </div>
        <div class="essential">
          <svg class="ink ink-essential" aria-hidden="true"><use href="#ink-ticket"></use></svg>
          <span class="k">Tickets</span>
          <span class="v">From £15</span>
          <span class="sub">Under 12s go free</span>
        </div>
        <div class="essential">
          <svg class="ink ink-essential" aria-hidden="true"><use href="#ink-wheel"></use></svg>
          <span class="k">What</span>
          <span class="v">60+ makers, 250 cheeses</span>
          <span class="sub">Live music, demos, bars</span>
        </div>
      </div>
    </div>
  </section>

  <div class="ticker" aria-hidden="true">
    <div class="ticker-track">
      <span>60+ makers<em>✦</em>250 cheeses<em>✦</em>Live music<em>✦</em>Cider &amp; craft beer<em>✦</em>Cheesemaking demos<em>✦</em>The Sunday Proms<em>✦</em></span>
      <span>60+ makers<em>✦</em>250 cheeses<em>✦</em>Live music<em>✦</em>Cider &amp; craft beer<em>✦</em>Cheesemaking demos<em>✦</em>The Sunday Proms<em>✦</em></span>
    </div>
  </div>

  <!-- Booking, high up: pick a day and go. -->
  <section id="tickets" class="section-tight">
    <div class="container">
      <div data-reveal style="margin-bottom: var(--space-lg);">
        <span class="label">Tickets</span>
        <h2>Pick your day.</h2>
        <svg class="ink-rule" aria-hidden="true"><use href="#ink-underline"></use></svg>
        <p class="lede">Two days, two very different moods. Or take the weekend and do both.</p>
      </div>

      <div class="days" data-reveal>
        <div class="day">
          <img class="day-img" src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/toastie-wide.jpg" alt="A toasted cheese sandwich on the griddle" loading="lazy">
          <div class="day-inner">
            <span class="day-when">Saturday 5 June</span>
            <h3>The family day</h3>
            <p>Funfair rides, fete games, cooking demos through the afternoon, and live music from legacy and chart-topping bands running late into the evening.</p>
            <div class="day-foot">
              <span class="day-price">£15 <span>/ adult</span></span>
              <!-- WORDPRESS: replace # with the checkout URL for this date -->
              <a href="#" class="btn btn-primary" data-buy="saturday">Book Saturday</a>
            </div>
          </div>
        </div>

        <div class="day">
          <img class="day-img" src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/cheers-close.jpg" alt="Festival-goers raising glasses at golden hour" loading="lazy">
          <div class="day-inner">
            <span class="day-when">Sunday 6 June</span>
            <h3>The Proms</h3>
            <p>A more traditional turn — a full philharmonic orchestra with leading singers through the evening, finishing on a grand spectacle.</p>
            <div class="day-foot">
              <span class="day-price">£18 <span>/ adult</span></span>
              <a href="#" class="btn btn-primary" data-buy="sunday">Book Sunday</a>
            </div>
          </div>
        </div>
      </div>

      <div class="tickets mt-lg" data-reveal style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
        <div class="ticket featured">
          <div class="ticket-name">Weekend pass</div>
          <div class="ticket-note">Both days, come and go</div>
          <div class="price">£25<span> / adult</span></div>
          <ul>
            <li>Saturday and Sunday</li>
            <li>Fast-track entry</li>
            <li>Festival tote bag</li>
          </ul>
          <a href="#" class="btn btn-primary btn-block" data-buy="weekend">Book the weekend</a>
        </div>
        <div class="ticket">
          <div class="ticket-name">VIP</div>
          <div class="ticket-note">Weekend pass, upgraded</div>
          <div class="price">£45<span> / adult</span></div>
          <ul>
            <li>Lounge with premium drinks</li>
            <li>Proper seating all weekend</li>
            <li>Guided pairing session</li>
          </ul>
          <a href="#" class="btn btn-outline btn-block" data-buy="vip">Book VIP</a>
        </div>
        <div class="ticket">
          <div class="ticket-name">Groups &amp; families</div>
          <div class="ticket-note">Under 12s always free</div>
          <div class="price">10+<span> / group rate</span></div>
          <ul>
            <li>Discounted rates for ten or more</li>
            <li>Coach parking arranged</li>
            <li>Just drop us a line</li>
          </ul>
          <a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>" class="btn btn-outline btn-block">Enquire</a>
        </div>
      </div>
    </div>
  </section>

  <div class="ink-break" aria-hidden="true"><svg class="ink-divider"><use href="#ink-divider"></use></svg></div>

  <!-- What actually happens, and when. -->
  <section id="whats-on" class="section-tight">
    <div class="container-narrow">
      <div data-reveal>
        <span class="label">What's on</span>
        <h2>How the day goes.</h2>
        <svg class="ink-rule" aria-hidden="true"><use href="#ink-underline"></use></svg>
        <p class="lede">The same shape both days — the market in the morning, the main event from two.</p>
      </div>
      <div class="programme mt-lg" data-reveal>
        <div class="programme-row">
          <span class="time">10:00</span>
          <div><h3>Farmers market opens</h3><p>Gates, coffee and first pick of the stalls.</p></div>
        </div>
        <div class="programme-row">
          <span class="time">11:30</span>
          <div><h3>Cheesemaking demonstrations</h3><p>In the demo tent, hourly from here on.</p></div>
        </div>
        <div class="programme-row">
          <span class="time">13:30</span>
          <div><h3>Market closes, main arena opens</h3><p>Half an hour to find yourself a spot.</p></div>
        </div>
        <div class="programme-row">
          <span class="time">14:00</span>
          <div><h3>Main event begins</h3><p>Funfair and bands on Saturday; the orchestra on Sunday.</p></div>
        </div>
        <div class="programme-row">
          <span class="time">17:00</span>
          <div><h3>Cheese &amp; cider pairing</h3><p>Ticketed sessions in the tasting tent.</p></div>
        </div>
        <div class="programme-row">
          <span class="time">21:30</span>
          <div><h3>Close</h3><p>Saturday runs late; Sunday ends on the spectacle.</p></div>
        </div>
      </div>
      <p class="mt-lg" style="color: var(--ink-mute); font-size: var(--size-sm);">Times are indicative and may shift slightly on the day.</p>
    </div>
  </section>

  <section class="band" style="background-image:url('assets/img/cheese-crates.jpg')">
    <div class="container" data-reveal>
      <span class="label label-light">The market</span>
      <h2>250 British cheeses, and the makers behind every one.</h2>
        <svg class="ink-rule" aria-hidden="true"><use href="#ink-underline"></use></svg>
      <p>Territorials, soft and blue, washed rinds, goat and sheep — from dairies across Britain, each with someone on the stall who can tell you exactly how it was made.</p>
    </div>
  </section>

  <section id="lineup" class="lineup section-tight">
    <div class="container">
      <div data-reveal>
        <span class="label">The 2027 line-up</span>
        <p class="lineup-list">
          Mendip Hills Dairy <span class="sep">·</span> Willow Farm Creamery <span class="sep">·</span>
          Orchard &amp; Oak <span class="sep">·</span> Quicke&rsquo;s <span class="sep">·</span>
          Cropwell Bishop <span class="sep">·</span> Isle of Mull <span class="sep">·</span>
          Hafod <span class="sep">·</span> Baron Bigod
          <span class="small">Plus 50 more makers announced through the spring.</span>
        </p>
        <a href="<?php echo esc_url( home_url( '/vendors/' ) ); ?>" class="btn btn-outline" style="margin-top: var(--space-lg);">Trade with us</a>
      </div>
    </div>
  </section>

  <section class="gallery" aria-label="Photographs from the festival">
    <figure style="margin:0"><img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/cheese-display.jpg" alt="Wheels and wedges of British cheese stacked on wooden crates" loading="lazy"></figure>
    <figure style="margin:0"><img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/friends-laughing.jpg" alt="Friends laughing together with drinks at the festival" loading="lazy"></figure>
    <figure style="margin:0"><img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/stall-flowers.jpg" alt="A cheese stall dressed with wildflowers under a marquee" loading="lazy"></figure>
    <figure style="margin:0"><img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/grilled-cheese.jpg" alt="A toasted cheese sandwich being served" loading="lazy"></figure>
  </section>

  <div class="ink-break" aria-hidden="true"><svg class="ink-divider"><use href="#ink-divider"></use></svg></div>

  <section id="faq" class="section-tight">
    <div class="container-narrow">
      <div data-reveal>
        <span class="label">Good to know</span>
        <h2>Before you come.</h2>
        <svg class="ink-rule" aria-hidden="true"><use href="#ink-underline"></use></svg>
      </div>
      <div class="mt-lg">
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="true" aria-controls="faq-1">Where is it?<span class="plus">+</span></button>
          <div class="accordion-panel is-open" id="faq-1"><p>The 2027 venue is being confirmed and will be announced shortly — join the list below and you'll hear first. On-site parking will be free for ticket holders.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-2">Do I need to book in advance?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-2"><p>Yes. Tickets are date-specific and popular days do sell out. Booking ahead is cheaper than paying on the gate.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-3">Are children welcome?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-3"><p>Very. Under 12s come in free, and Saturday is built around families — funfair, fete games and a kids' tasting area.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-4">Are dogs allowed?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-4"><p>Well-behaved dogs on leads are welcome across the site, but not inside the tasting tent for food hygiene reasons.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-5">Is the site accessible?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-5"><p>Yes — level access throughout, accessible toilets, and free entry for one essential companion. Email us ahead and we'll make sure everything's arranged.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-6">Can I get a refund?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-6"><p>Tickets are transferable to someone else at any time but non-refundable, in line with our ticketing partner's terms.</p></div>
        </div>
      </div>
    </div>
  </section>

  <section class="signup" id="signup">
    <div class="container">
      <div class="signup-inner">
        <div data-reveal>
          <span class="label">Stay in the loop</span>
          <h2>Be first to hear.</h2>
        <svg class="ink-rule" aria-hidden="true"><use href="#ink-underline"></use></svg>
          <p class="lede">The venue announcement, the full line-up of makers, and early-bird tickets before they go on general sale. No more than one email a month.</p>
        </div>

        <!-- WORDPRESS: point action= at your Mailchimp/Brevo form URL, or replace
             this whole form with your newsletter plugin's shortcode. See README. -->
        <form class="signup-form" id="signup-form" method="post" action="" novalidate data-reveal>
          <div class="signup-fields">
            <div class="form-field">
              <label for="s-name">First name</label>
              <input type="text" id="s-name" name="FNAME" autocomplete="given-name" required>
            </div>
            <div class="form-field">
              <label for="s-email">Email address</label>
              <input type="email" id="s-email" name="EMAIL" autocomplete="email" required>
            </div>
          </div>

          <div class="consent">
            <input type="checkbox" id="s-consent" name="consent" value="yes" required>
            <label for="s-consent">Yes, email me festival news, line-up announcements and ticket releases.</label>
          </div>

          <button type="submit" class="btn btn-primary">Sign me up</button>
          <p class="form-note">We store your details only to send you what you&rsquo;ve asked for, and you can unsubscribe from any email. See our <a href="<?php echo esc_url( home_url( '/privacy/' ) ); ?>" class="link" style="font-size:inherit">privacy policy</a>.</p>
          <p id="signup-error" class="form-error" hidden></p>
          <p id="signup-success" class="form-success" hidden>Thanks — you&rsquo;re on the list. Look out for the venue announcement.</p>
        </form>
      </div>
    </div>
  </section>

<?php
get_footer();
