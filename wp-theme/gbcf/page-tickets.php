<?php
/**
 * Tickets — Applies automatically to the page with the slug 'tickets'.
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
      <span class="label">Tickets</span>
      <h1>Book your day.</h1>
      <p>Straight through to secure checkout — tickets arrive by email, nothing to print. Under 12s come in free.</p>
    </div>
  </section>

  <section id="buy" class="section-tight">
    <div class="container">
      <div class="tickets" data-reveal>

        <div class="ticket">
          <div class="ticket-name">Saturday</div>
          <div class="ticket-note">5 June · The family day</div>
          <div class="price">£15<span> / adult</span></div>
          <ul>
            <li>Market 10:00, main arena 14:00–21:30</li>
            <li>Funfair and fete games</li>
            <li>Live bands through the afternoon</li>
            <li>Cooking demonstrations</li>
          </ul>
          <!-- Replace # with the Ticket Tailor / Eventbrite checkout URL for this date -->
          <a href="#" class="btn btn-outline btn-block" data-buy="saturday">Book Saturday</a>
        </div>

        <div class="ticket featured">
          <div class="ticket-name">Weekend pass</div>
          <div class="ticket-note">Both days, come and go</div>
          <div class="price">£25<span> / adult</span></div>
          <ul>
            <li>Saturday and Sunday</li>
            <li>Fast-track entry</li>
            <li>Festival tote bag</li>
            <li>Best value of the three</li>
          </ul>
          <a href="#" class="btn btn-primary btn-block" data-buy="weekend">Book the weekend</a>
        </div>

        <div class="ticket">
          <div class="ticket-name">Sunday</div>
          <div class="ticket-note">6 June · The Proms</div>
          <div class="price">£18<span> / adult</span></div>
          <ul>
            <li>Market 10:00, main arena 14:00–21:30</li>
            <li>Full philharmonic orchestra</li>
            <li>Leading singers into the evening</li>
            <li>Closing spectacle</li>
          </ul>
          <a href="#" class="btn btn-outline btn-block" data-buy="sunday">Book Sunday</a>
        </div>

      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      <div class="split" data-reveal>
        <div class="split-media wide">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/stall-flowers.jpg" alt="A cheese stall dressed with wildflowers under a marquee" loading="lazy">
        </div>
        <div class="split-body">
          <span class="label">Upgrade</span>
          <h2>VIP, £45.</h2>
          <p>Everything in the weekend pass, plus an exclusive lounge with premium drinks and proper seating, and a guided cheese and cider pairing session with one of the makers.</p>
          <a href="#" class="btn btn-primary" data-buy="vip">Book VIP</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container-narrow">
      <div data-reveal>
        <span class="label">Before you book</span>
        <h2>The details.</h2>
      </div>
      <div class="mt-lg">
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="true" aria-controls="faq-1">How do I get my tickets?<span class="plus">+</span></button>
          <div class="accordion-panel is-open" id="faq-1"><p>By email, seconds after payment. Show it on your phone at the gate — there's nothing to print.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-2">Can I change my date?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-2"><p>Yes, subject to availability. Reply to your confirmation email and we'll move it across for you.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-3">Is parking included?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-3"><p>On-site parking is free for ticket holders. Directions will follow once the venue is confirmed.</p></div>
        </div>
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-4">Booking for a group?<span class="plus">+</span></button>
          <div class="accordion-panel" id="faq-4"><p>For ten or more we can offer group rates and arrange coach parking — <a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>" class="link">get in touch</a>.</p></div>
        </div>
      </div>
    </div>
  </section>

<?php
get_footer();
