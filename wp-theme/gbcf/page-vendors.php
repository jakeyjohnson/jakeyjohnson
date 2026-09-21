<?php
/**
 * Stallholders — Applies automatically to the page with the slug 'vendors'.
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
      <span class="label">Stallholders</span>
      <h1>Trade at the festival.</h1>
      <p>Pitches across cheese, cider, craft beer and artisan food, 5–6 June 2027. We reply to every application within five working days.</p>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div class="stats" data-reveal>
        <div class="stat"><strong>5–6k</strong><span>Visitors across the weekend</span></div>
        <div class="stat"><strong>60+</strong><span>Traders alongside you</span></div>
        <div class="stat"><strong>2</strong><span>Full trading days</span></div>
        <div class="stat"><strong>Free</strong><span>Parking beside your pitch</span></div>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div data-reveal style="max-width: 46ch; margin-bottom: var(--space-lg);">
        <span class="label">Who trades</span>
        <h2>Independent makers only.</h2>
        <p class="lede">No resellers. Every stall is the producer, on the stall, talking to customers about what they made.</p>
      </div>
      <div class="cards" data-reveal>
        <div class="card">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/cheese-display.jpg" alt="Clothbound cheddar on a market stall" loading="lazy">
          <span class="card-kind">Cheddar</span>
          <h3>Mendip Hills Dairy</h3>
          <p>Award-winning clothbound cheddar, aged eighteen months in a Somerset cave.</p>
        </div>
        <div class="card">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/stall-flowers.jpg" alt="Soft cheese on a stall dressed with wildflowers" loading="lazy">
          <span class="card-kind">Goat's cheese</span>
          <h3>Willow Farm Creamery</h3>
          <p>Small-batch soft goat's cheese from a forty-strong herd in Devon.</p>
        </div>
        <div class="card">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/cheers-close.jpg" alt="Cider being poured at the festival bar" loading="lazy">
          <span class="card-kind">Cider</span>
          <h3>Orchard &amp; Oak</h3>
          <p>Single-varietal ciders pressed from a two-hundred-year-old West Country orchard.</p>
        </div>
      </div>
      <p class="mt-lg" style="color: var(--ink-mute); font-size: var(--size-sm);">Example listings — the confirmed 2027 line-up will be published here.</p>
    </div>
  </section>

  <section id="apply">
    <div class="container">
      <div class="split" data-reveal>
        <div class="split-body">
          <span class="label">Apply</span>
          <h2>Take a pitch.</h2>
          <p>Tell us what you make and we'll come back with pitch options and pricing. Priority goes to independent producers.</p>
          <ul style="list-style:none; padding:0; margin: var(--space-md) 0 0; font-size: var(--size-sm); color: var(--ink-soft);">
            <li style="padding:0.55rem 0; border-top:1px solid var(--line-faint);">Public liability insurance, minimum £5m</li>
            <li style="padding:0.55rem 0; border-top:1px solid var(--line-faint);">Food hygiene certification for tastings and samples</li>
            <li style="padding:0.55rem 0; border-top:1px solid var(--line-faint);">Applications close 1 May 2027</li>
          </ul>
        </div>
        <form data-reveal id="vendor-form" novalidate>
          <div class="form-field">
            <label for="v-business">Business name</label>
            <input type="text" id="v-business" name="business" required>
          </div>
          <div class="form-field">
            <label for="v-contact">Contact name</label>
            <input type="text" id="v-contact" name="contact" autocomplete="name" required>
          </div>
          <div class="form-field">
            <label for="v-email">Email</label>
            <input type="email" id="v-email" name="email" autocomplete="email" required>
          </div>
          <div class="form-field">
            <label for="v-phone">Phone</label>
            <input type="tel" id="v-phone" name="phone" autocomplete="tel" required>
          </div>
          <div class="form-field">
            <label for="v-category">What do you sell?</label>
            <select id="v-category" name="category" required>
              <option value="">Choose one…</option>
              <option>Cheese</option>
              <option>Cider or beer</option>
              <option>Other artisan food &amp; drink</option>
              <option>Non-food trade stand</option>
            </select>
          </div>
          <div class="form-field">
            <label for="v-details">Tell us about your business</label>
            <textarea id="v-details" name="details" rows="4" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Submit application</button>
          <p id="vendor-success" class="form-success" style="display:none; margin-top: var(--space-md);">Thanks — your application's in. We'll be in touch within five working days.</p>
        </form>
      </div>
    </div>
  </section>

<?php
get_footer();
