<?php
/**
 * Theme setup for The Great British Cheese Festival.
 *
 * @package GBCF
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GBCF_VERSION', '1.0.0' );

/**
 * Tell WordPress what the theme supports.
 */
function gbcf_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'responsive-embeds' );
}
add_action( 'after_setup_theme', 'gbcf_setup' );

/**
 * Load the fonts, the design tokens, the stylesheet and the one script.
 *
 * Google Fonts is loaded here rather than with @import inside the CSS so it
 * starts downloading in parallel with the stylesheet instead of after it.
 */
function gbcf_assets() {
	$uri = get_template_directory_uri();
	$dir = get_template_directory();

	wp_enqueue_style(
		'gbcf-fonts',
		'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&display=swap',
		array(),
		null
	);

	wp_enqueue_style( 'gbcf-tokens', $uri . '/assets/css/tokens.css', array(), filemtime( $dir . '/assets/css/tokens.css' ) );
	wp_enqueue_style( 'gbcf-style', $uri . '/assets/css/style.css', array( 'gbcf-tokens' ), filemtime( $dir . '/assets/css/style.css' ) );

	wp_enqueue_script( 'gbcf-main', $uri . '/assets/js/main.js', array(), filemtime( $dir . '/assets/js/main.js' ), true );
}
add_action( 'wp_enqueue_scripts', 'gbcf_assets' );

/**
 * Preconnect to the font host so the first paint is not waiting on DNS.
 */
function gbcf_resource_hints( $hints, $relation ) {
	if ( 'preconnect' === $relation ) {
		$hints[] = array( 'href' => 'https://fonts.gstatic.com', 'crossorigin' );
	}
	return $hints;
}
add_filter( 'wp_resource_hints', 'gbcf_resource_hints', 10, 2 );
