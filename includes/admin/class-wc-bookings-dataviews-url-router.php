<?php
/**
 * WC_Bookings_DataViews_URL_Router class.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_DataViews_URL_Router' ) ) {
	return;
}

/**
 * Rewrites the WC Bookings edit-booking URL to point at the DataViews
 * detail screen whenever the DataViews feature flag is enabled. Hooks
 * the central `woocommerce_bookings_edit_booking_url` filter so every
 * caller of `wc_bookings_get_edit_booking_url()` follows the toggle —
 * order screen "View booking" link, admin emails, the personalization
 * tag, the Google Calendar event description, etc.
 */
class WC_Bookings_DataViews_URL_Router {

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_filter( 'woocommerce_bookings_edit_booking_url', array( $this, 'rewrite_url' ), 10, 2 );
	}

	/**
	 * Replace the classic post.php edit URL with the DataViews detail URL.
	 *
	 * @param string $url        Original edit-booking URL.
	 * @param int    $booking_id Booking ID.
	 * @return string
	 */
	public function rewrite_url( $url, $booking_id ) {
		$booking_id = absint( $booking_id );
		if ( ! $booking_id ) {
			return $url;
		}

		return admin_url(
			'edit.php?post_type=wc_booking&page=' . WC_Bookings_DataViews_Page::PAGE_SLUG . '&booking=' . $booking_id
		);
	}
}
