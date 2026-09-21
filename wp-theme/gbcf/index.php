<?php
/**
 * Fallback template. Anything without a template of its own — a blog post,
 * a new page, a search result — renders here inside the site chrome.
 *
 * @package GBCF
 */
get_header();
?>
<section class="section-tight">
  <div class="container-narrow">
    <?php if ( have_posts() ) : ?>
      <?php while ( have_posts() ) : the_post(); ?>
        <article <?php post_class(); ?>>
          <h1><?php the_title(); ?></h1>
          <div class="measure"><?php the_content(); ?></div>
        </article>
      <?php endwhile; ?>
    <?php else : ?>
      <h1>Nothing here</h1>
      <p class="lede">That page has moved or never existed. <a class="link" href="<?php echo esc_url( home_url( '/' ) ); ?>">Back to the festival</a>.</p>
    <?php endif; ?>
  </div>
</section>
<?php
get_footer();
