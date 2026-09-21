<?php
/**
 * Privacy — Applies automatically to the page with the slug 'privacy'.
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
      <span class="label">The small print</span>
      <h1>Privacy &amp; cookies.</h1>
      <p>Last updated: 16 September 2026</p>
    </div>
  </section>

  <section>
    <div class="container" style="max-width: 760px;">
      <h2>What we collect</h2>
      <p>When you buy a ticket, your name, email and order details are collected and processed by our ticketing partner's checkout, not stored on this site. When you fill in the stallholder or contact form, we collect the details you enter solely to reply to your enquiry.</p>

      <h2>How we use it</h2>
      <p>To send you your tickets, respond to enquiries, and — only if you've opted in — occasional festival updates. We never sell your details to third parties.</p>

      <h2>Cookies</h2>
      <p>This site uses only essential cookies needed for it to function. It does not use tracking or advertising cookies.</p>

      <h2>Your rights</h2>
      <p>You can ask us what data we hold on you, or ask us to delete it, at any time by emailing <a href="mailto:hello@greatbritishcheesefestival.co.uk">hello@greatbritishcheesefestival.co.uk</a>.</p>

      <h2>Contact</h2>
      <p>Questions about this policy? <a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">Get in touch</a>.</p>
    </div>
  </section>
<?php
get_footer();
