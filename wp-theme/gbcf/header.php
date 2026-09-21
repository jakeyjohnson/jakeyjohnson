<?php
/**
 * Page chrome: document head, the sticky header and the bunting.
 *
 * @package GBCF
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
// The hand-drawn illustrations, inlined once so every <use> on the page
// resolves without a second request.
readfile( get_template_directory() . '/inc/ink-sprite.svg' );
?>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <nav class="nav">
    <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="nav-logo">
      <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/img/logo.png" alt="The Great British Cheese Festival" data-brand-mark style="display:none">
      <span class="nav-logo-type">The Great British<br>Cheese Festival<small>5–6 June 2027</small></span>
    </a>
    <ul class="nav-links">
      <li><a href="#tickets">Tickets</a></li>
      <li><a href="#whats-on">What's on</a></li>
      <li><a href="#lineup">Line-up</a></li>
      <li><a href="#faq">Info</a></li>
      <li><a href="<?php echo esc_url( home_url( '/vendors/' ) ); ?>">Stallholders</a></li>
    </ul>
    <a href="#tickets" class="btn btn-primary nav-cta">Book tickets</a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="mobile-panel">
      <span></span><span></span><span></span>
    </button>
  </nav>
  <div class="mobile-panel" id="mobile-panel">
    <ul>
      <li><a href="#tickets">Tickets</a></li>
      <li><a href="#whats-on">What's on</a></li>
      <li><a href="#lineup">Line-up</a></li>
      <li><a href="#faq">Info</a></li>
      <li><a href="<?php echo esc_url( home_url( '/vendors/' ) ); ?>">Stallholders</a></li>
      <li><a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">Contact</a></li>
    </ul>
    <a href="#tickets" class="btn btn-primary btn-block">Book tickets</a>
  </div>
</header>
<div class="bunting" aria-hidden="true"></div>

<main id="main">
