<?php
/**
 * Site footer and the persistent booking bar.
 *
 * @package GBCF
 */
?>
</main>

<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/logo.png" alt="" class="footer-mark" data-brand-mark style="display:none">
        <h4>The Great British Cheese Festival</h4>
        <p style="max-width:34ch; font-size: var(--size-sm);">5–6 June 2027. Venue to be announced. Savour the flavours of Britain.</p>
      </div>
      <div>
        <h4>Visit</h4>
        <a href="#tickets">Tickets</a>
        <a href="#whats-on">What's on</a>
        <a href="#signup">Newsletter</a>
      </div>
      <div>
        <h4>Trade &amp; press</h4>
        <a href="<?php echo esc_url( home_url( '/vendors/' ) ); ?>">Stallholders</a>
        <a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">Contact</a>
        <a href="<?php echo esc_url( home_url( '/privacy/' ) ); ?>">Privacy</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2027 The Great British Cheese Festival</span>
      <span>5–6 June 2027</span>
    </div>
  </div>
</footer>

<!-- Booking stays within reach the whole way down the page. -->
<div class="book-bar" id="book-bar">
  <div class="bar-info">
    <span class="bar-title">From £15 · Under 12s free</span>
    <span class="bar-sub">Sat 5 &amp; Sun 6 June 2027</span>
  </div>
  <span class="ink-point" aria-hidden="true"><svg><use href="#ink-arrow"></use></svg></span>
  <a href="#tickets" class="btn btn-primary">Book tickets</a>
</div>

<?php wp_footer(); ?>
</body>
</html>
