<?php
/**
 * Back-fill order notes on every order linked to a booking.
 *
 * Run with:
 *   npx wp-env run cli wp eval-file wp-content/plugins/woocommerce-bookings-dataviews/scripts/backfill-order-notes.php
 *
 * Walks every wc_booking, finds its linked order, and adds a single
 * realistic order note if the order has only auto-generated status
 * notes (no manual one yet). Idempotent — safe to re-run.
 */

if ( ! function_exists( 'get_wc_booking' ) ) {
	WP_CLI::error( 'WooCommerce + Bookings must be active.' );
}

$note_templates = array(
	'Customer prefers afternoon appointments.',
	'First-time customer — recommended by a friend.',
	'Returning customer, regular service.',
	'Customer requested a specific stylist.',
	'Customer was very satisfied last time.',
	'Asked about retail products at checkout.',
	'Customer is bringing a friend next time.',
	'Booked via mobile.',
	'Customer arrived on time, no special requests.',
	'Booking confirmed via email.',
	'Customer requested a quieter chair.',
	'Walked in for this slot.',
	'Likes shorter conversations during the session.',
	'Allergic to certain hair products — please use fragrance-free.',
	'Has a preferred drink (water, no ice).',
);

$booking_ids = get_posts(
	array(
		'post_type'      => 'wc_booking',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'post_status'    => 'any',
	)
);

$added   = 0;
$skipped = 0;
$noOrder = 0;

foreach ( $booking_ids as $booking_id ) {
	$booking = get_wc_booking( $booking_id );
	if ( ! $booking ) {
		continue;
	}
	$order_id = $booking->get_order_id();
	if ( ! $order_id ) {
		++$noOrder;
		continue;
	}

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		continue;
	}

	// Skip if the order already has a manual note (anything that doesn't
	// look like an automatic status-change message).
	$existing   = wc_get_order_notes( array( 'order_id' => $order_id ) );
	$has_manual = false;
	foreach ( $existing as $note_obj ) {
		$content = $note_obj->content;
		if (
			! preg_match( '/^Order status changed from/i', $content ) &&
			! preg_match( '/^Booking #\d+ status changed/i', $content )
		) {
			$has_manual = true;
			break;
		}
	}
	if ( $has_manual ) {
		++$skipped;
		continue;
	}

	$note = $note_templates[ $booking_id % count( $note_templates ) ];
	$order->add_order_note( $note );
	++$added;
	WP_CLI::log( "  + order #{$order_id} ← {$note}" );
}

WP_CLI::success( "Added: {$added} | Skipped (already had note): {$skipped} | No order: {$noOrder}" );
