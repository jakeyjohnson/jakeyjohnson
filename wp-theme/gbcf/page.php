<?php
/**
 * Any page the team adds in WordPress that has no template of its own.
 *
 * @package GBCF
 */
get_header();
?>
<section class="section-tight">
  <div class="container-narrow">
    <?php while ( have_posts() ) : the_post(); ?>
      <h1><?php the_title(); ?></h1>
      <div class="measure"><?php the_content(); ?></div>
    <?php endwhile; ?>
  </div>
</section>
<?php
get_footer();
