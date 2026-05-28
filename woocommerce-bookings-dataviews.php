<?php
/**
 * Plugin Name: WooCommerce Bookings Enhanced
 * Plugin URI: https://woocommerce.com/products/woocommerce-bookings/
 * Description: Customer-facing booking form improvements plus an opt-in modal/popup flow, and a DataViews-powered "All Bookings" admin screen — all behind feature flags.
 * Version: 0.1.0
 * Requires Plugins: woocommerce, woocommerce-bookings
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: WooCommerce
 * License: GPL-2.0-or-later
 * Text Domain: woocommerce-bookings
 *
 * @package WooCommerce Bookings Enhanced
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WC_BOOKINGS_DATAVIEWS_VERSION', '0.1.0' );
define( 'WC_BOOKINGS_DATAVIEWS_PATH', plugin_dir_path( __FILE__ ) );
define( 'WC_BOOKINGS_DATAVIEWS_URL', untrailingslashit( plugin_dir_url( __FILE__ ) ) );

/**
 * Bootstrap the DataViews mini-extension.
 *
 * Runs after WooCommerce Bookings has loaded so we can rely on its
 * post type, classes, and helper functions.
 */
function wc_bookings_dataviews_bootstrap() {
	if ( ! class_exists( 'WC_Bookings' ) ) {
		add_action( 'admin_notices', 'wc_bookings_dataviews_missing_dep_notice' );
		return;
	}

	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-features.php';
	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-dataviews-rest.php';
	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-dataviews-page.php';
	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-dataviews-menu.php';
	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-dataviews-url-router.php';
	require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/class-wc-bookings-dataviews-refund-redirect.php';

	if ( WC_Bookings_Features::is_enabled( WC_Bookings_Features::FEATURE_DATAVIEWS ) ) {
		new WC_Bookings_DataViews_REST();
		new WC_Bookings_DataViews_URL_Router();
	}

	if ( ! is_admin() ) {
		require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/frontend/class-wc-bookings-frontend.php';
		new WC_Bookings_Frontend();

		if ( WC_Bookings_Features::is_enabled( WC_Bookings_Features::FEATURE_MODAL_BOOKING ) ) {
			require_once WC_BOOKINGS_DATAVIEWS_PATH . 'includes/frontend/class-wc-bookings-modal-flow.php';
			new WC_Bookings_Modal_Flow();
		}
	}

	if ( is_admin() ) {
		new WC_Bookings_Features();

		if ( WC_Bookings_Features::is_enabled( WC_Bookings_Features::FEATURE_DATAVIEWS ) ) {
			new WC_Bookings_DataViews_Menu();
			new WC_Bookings_DataViews_Page();
			new WC_Bookings_DataViews_Refund_Redirect();
		}
	}
}
add_action( 'plugins_loaded', 'wc_bookings_dataviews_bootstrap', 20 );

/**
 * Admin notice shown when WooCommerce Bookings is missing.
 */
function wc_bookings_dataviews_missing_dep_notice() {
	echo '<div class="notice notice-error"><p>';
	esc_html_e( 'WooCommerce Bookings — DataViews requires the WooCommerce Bookings plugin to be installed and active.', 'woocommerce-bookings' );
	echo '</p></div>';
}
