<?php
/**
 * WC_Bookings_Frontend class.
 *
 * Loads always-on frontend tweaks for bookable product pages, regardless
 * of the modal feature flag:
 *
 *  - JS: adds `wp-element-button` to the inline form's Add to Cart so
 *    block themes can style it (WC core does this for every other
 *    product type automatically).
 *  - CSS: strips WC Bookings' legacy nested-container borders so the
 *    form fits a modern block theme.
 *
 * When the modal flag is on, the inline form isn't rendered, so the JS
 * selector matches nothing and the CSS rules harmlessly target nothing.
 *
 * @package WooCommerce Bookings DataViews
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_Frontend' ) ) {
	return;
}

/**
 * Always-on frontend tweaks for bookable product pages.
 */
class WC_Bookings_Frontend {

	const ASSET_HANDLE = 'wc-bookings-frontend';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue' ) );
		add_filter( 'woocommerce_booking_single_check_availability_text', array( $this, 'rename_check_availability_button' ) );
	}

	/**
	 * Replace the "Check Availability" submit-button label on bookings
	 * that require confirmation with the plain "Book now" label used by
	 * non-confirmation bookings. The original label reads as a separate
	 * step ("first I check, then maybe I book") which isn't actually
	 * what the submit button does — it adds the booking to the cart
	 * either way; the merchant just confirms it later. "Book now" is
	 * clearer to customers.
	 *
	 * @return string
	 */
	public function rename_check_availability_button() {
		return __( 'Book now', 'woocommerce-bookings' );
	}

	/**
	 * Enqueues the assets only on bookable single-product pages.
	 */
	public function maybe_enqueue() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		$product = wc_get_product( get_the_ID() );

		if ( ! $product || 'booking' !== $product->get_type() ) {
			return;
		}

		$asset_file = WC_BOOKINGS_DATAVIEWS_PATH . 'build/bookings-frontend.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			self::ASSET_HANDLE,
			WC_BOOKINGS_DATAVIEWS_URL . '/build/bookings-frontend.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_enqueue_style(
			self::ASSET_HANDLE,
			WC_BOOKINGS_DATAVIEWS_URL . '/build/bookings-frontend.css',
			array(),
			$asset['version']
		);
	}
}
