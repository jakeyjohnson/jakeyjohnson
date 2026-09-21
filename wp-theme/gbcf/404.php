<?php
/**
 * Not found.
 *
 * @package GBCF
 */
get_header();
?>
<section class="section-tight">
  <div class="container-narrow">
    <span class="label">Lost</span>
    <h1>That page has wandered off.</h1>
    <p class="lede">Try the <a class="link" href="<?php echo esc_url( home_url( '/tickets/' ) ); ?>">tickets page</a>, or start again from the <a class="link" href="<?php echo esc_url( home_url( '/' ) ); ?>">front page</a>.</p>
  </div>
</section>
<?php
get_footer();
