<?php
/**
 * Contact — Applies automatically to the page with the slug 'contact'.
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
      <span class="label">Contact</span>
      <h1>Get in touch.</h1>
      <p>Ticketing questions, group bookings, press or anything else — we usually reply within two working days.</p>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div class="split" data-reveal>
        <div class="split-body">
          <span class="label">Direct</span>
          <h2>Email us.</h2>
          <ul style="list-style:none; padding:0; margin:var(--space-md) 0 0;">
            <li style="padding:var(--space-sm) 0; border-top:1px solid var(--line-faint);">
              <h3>General enquiries</h3>
              <a class="link" href="mailto:hello@greatbritishcheesefestival.co.uk">hello@greatbritishcheesefestival.co.uk</a>
            </li>
            <li style="padding:var(--space-sm) 0; border-top:1px solid var(--line-faint);">
              <h3>Ticket support</h3>
              <a class="link" href="mailto:tickets@greatbritishcheesefestival.co.uk">tickets@greatbritishcheesefestival.co.uk</a>
            </li>
            <li style="padding:var(--space-sm) 0; border-top:1px solid var(--line-faint);">
              <h3>Trading &amp; stallholders</h3>
              <a class="link" href="<?php echo esc_url( home_url( '/vendors/' ) ); ?>#apply">Apply for a pitch</a>
            </li>
          </ul>
        </div>
        <form data-reveal id="contact-form" novalidate>
          <div class="form-field">
            <label for="c-name">Name</label>
            <input type="text" id="c-name" name="name" autocomplete="name" required>
          </div>
          <div class="form-field">
            <label for="c-email">Email</label>
            <input type="email" id="c-email" name="email" autocomplete="email" required>
          </div>
          <div class="form-field">
            <label for="c-topic">Topic</label>
            <select id="c-topic" name="topic" required>
              <option value="">Choose one…</option>
              <option>Ticket support</option>
              <option>Group booking</option>
              <option>Press</option>
              <option>Something else</option>
            </select>
          </div>
          <div class="form-field">
            <label for="c-message">Message</label>
            <textarea id="c-message" name="message" rows="5" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Send message</button>
          <p id="contact-success" class="form-success" style="display:none; margin-top: var(--space-md);">Thanks — we've got your message and will reply soon.</p>
        </form>
      </div>
    </div>
  </section>

<?php
get_footer();
