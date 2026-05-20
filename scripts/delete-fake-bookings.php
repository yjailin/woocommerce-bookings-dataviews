<?php
/**
 * Delete all wc_booking posts that have no attached WooCommerce order
 * (the "fake" admin-seeded data that never went through a real booking
 * flow). Run after `seed-realistic-bookings.php` if you want the list
 * page to only show order-backed bookings.
 *
 * Run:
 *   npx wp-env run cli wp eval-file wp-content/plugins/woocommerce-bookings-dataviews/scripts/delete-fake-bookings.php
 */

if ( ! function_exists( 'get_wc_booking' ) ) {
	WP_CLI::error( 'WooCommerce + Bookings must be active.' );
}

$booking_ids = get_posts(
	array(
		'post_type'      => 'wc_booking',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'post_status'    => 'any',
	)
);

$deleted = 0;
$kept    = 0;

foreach ( $booking_ids as $booking_id ) {
	$booking = get_wc_booking( $booking_id );
	if ( ! $booking ) {
		continue;
	}
	if ( $booking->get_order_id() ) {
		++$kept;
		continue;
	}
	// `force_delete = true` so it skips the trash.
	wp_delete_post( $booking_id, true );
	++$deleted;
}

WP_CLI::success( "Deleted {$deleted} fake bookings (without order). Kept {$kept} with orders." );
