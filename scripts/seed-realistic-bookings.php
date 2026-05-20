<?php
/**
 * Seed realistic bookings for the DataViews detail-page demo.
 *
 * Run from the plugin root with:
 *   npx wp-env run cli wp eval-file wp-content/plugins/woocommerce-bookings-dataviews/scripts/seed-realistic-bookings.php
 *
 * Creates a dozen bookings, each attached to a real WooCommerce order with
 * billing details, so the Payment / Customer cards have actual data to
 * render. Non-destructive — existing bookings stay where they are.
 */

if ( ! function_exists( 'wc_create_order' ) || ! class_exists( 'WC_Booking' ) ) {
	WP_CLI::error( 'WooCommerce + Bookings must be active.' );
}

// 1. Tax setup — enable calculation and add an 8% rate if none exist, so
// the breakdown table shows a non-zero Tax line.
if ( 'yes' !== get_option( 'woocommerce_calc_taxes' ) ) {
	update_option( 'woocommerce_calc_taxes', 'yes' );
	WP_CLI::log( '✓ Enabled tax calculation' );
}
global $wpdb;
$rate_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}woocommerce_tax_rates" );
if ( 0 === $rate_count ) {
	$wpdb->insert(
		$wpdb->prefix . 'woocommerce_tax_rates',
		array(
			'tax_rate_country'  => '',
			'tax_rate_state'    => '',
			'tax_rate'          => '8.0000',
			'tax_rate_name'     => 'Sales Tax',
			'tax_rate_priority' => 1,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 0,
			'tax_rate_order'    => 0,
			'tax_rate_class'    => '',
		)
	);
	WP_CLI::log( '✓ Added 8% Sales Tax rate' );
}

// 2. Pick a bookable product.
$ids = get_posts(
	array(
		'post_type'      => 'product',
		'posts_per_page' => 1,
		'fields'         => 'ids',
		'tax_query'      => array(
			array(
				'taxonomy' => 'product_type',
				'field'    => 'slug',
				'terms'    => 'booking',
			),
		),
	)
);
if ( empty( $ids ) ) {
	WP_CLI::error( 'No bookable products found. Create one first.' );
}
$product = wc_get_product( $ids[0] );
WP_CLI::log( "✓ Using product: {$product->get_name()} (#{$product->get_id()})" );

// 3. Customer pool. All example.com addresses so it's obviously test data.
$customers = array(
	array(
		'first'    => 'Sophie',
		'last'     => 'Anderson',
		'email'    => 'sophie.anderson@example.com',
		'phone'    => '+1 503-555-1234',
		'addr'     => '1234 Maple Street',
		'city'     => 'Portland',
		'state'    => 'OR',
		'postcode' => '97201',
		'country'  => 'US',
	),
	array(
		'first'    => 'James',
		'last'     => 'Patel',
		'email'    => 'james.patel@example.com',
		'phone'    => '+1 206-555-2345',
		'addr'     => '5678 Oak Avenue',
		'city'     => 'Seattle',
		'state'    => 'WA',
		'postcode' => '98101',
		'country'  => 'US',
	),
	array(
		'first'    => 'Emma',
		'last'     => 'Garcia',
		'email'    => 'emma.garcia@example.com',
		'phone'    => '+1 415-555-3456',
		'addr'     => '910 Pine Road',
		'city'     => 'San Francisco',
		'state'    => 'CA',
		'postcode' => '94102',
		'country'  => 'US',
	),
	array(
		'first'    => 'Liam',
		'last'     => 'Nguyen',
		'email'    => 'liam.nguyen@example.com',
		'phone'    => '+1 212-555-4567',
		'addr'     => '321 Elm Boulevard',
		'city'     => 'New York',
		'state'    => 'NY',
		'postcode' => '10001',
		'country'  => 'US',
	),
	array(
		'first'    => 'Olivia',
		'last'     => 'Lee',
		'email'    => 'olivia.lee@example.com',
		'phone'    => '+1 312-555-5678',
		'addr'     => '654 Cedar Lane',
		'city'     => 'Chicago',
		'state'    => 'IL',
		'postcode' => '60601',
		'country'  => 'US',
	),
	array(
		'first'    => 'Noah',
		'last'     => 'Martin',
		'email'    => 'noah.martin@example.com',
		'phone'    => '+1 617-555-6789',
		'addr'     => '987 Birch Court',
		'city'     => 'Boston',
		'state'    => 'MA',
		'postcode' => '02108',
		'country'  => 'US',
	),
	array(
		'first'    => 'Ava',
		'last'     => 'Wilson',
		'email'    => 'ava.wilson@example.com',
		'phone'    => '+1 305-555-7890',
		'addr'     => '147 Walnut Way',
		'city'     => 'Miami',
		'state'    => 'FL',
		'postcode' => '33101',
		'country'  => 'US',
	),
	array(
		'first'    => 'Mateo',
		'last'     => 'Rodriguez',
		'email'    => 'mateo.rodriguez@example.com',
		'phone'    => '+1 512-555-8901',
		'addr'     => '258 Aspen Place',
		'city'     => 'Austin',
		'state'    => 'TX',
		'postcode' => '78701',
		'country'  => 'US',
	),
	array(
		'first'    => 'Isabella',
		'last'     => 'Chen',
		'email'    => 'isabella.chen@example.com',
		'phone'    => '+1 213-555-9012',
		'addr'     => '369 Willow Drive',
		'city'     => 'Los Angeles',
		'state'    => 'CA',
		'postcode' => '90001',
		'country'  => 'US',
	),
	array(
		'first'    => 'Ethan',
		'last'     => 'Hassan',
		'email'    => 'ethan.hassan@example.com',
		'phone'    => '+1 720-555-0123',
		'addr'     => '741 Spruce Trail',
		'city'     => 'Denver',
		'state'    => 'CO',
		'postcode' => '80202',
		'country'  => 'US',
	),
	array(
		'first'    => 'Mia',
		'last'     => 'Kowalski',
		'email'    => 'mia.kowalski@example.com',
		'phone'    => '+1 612-555-1230',
		'addr'     => '852 Sycamore Parkway',
		'city'     => 'Minneapolis',
		'state'    => 'MN',
		'postcode' => '55401',
		'country'  => 'US',
	),
	array(
		'first'    => 'Lucas',
		'last'     => 'Dubois',
		'email'    => 'lucas.dubois@example.com',
		'phone'    => '+1 504-555-2340',
		'addr'     => '963 Magnolia Avenue',
		'city'     => 'New Orleans',
		'state'    => 'LA',
		'postcode' => '70112',
		'country'  => 'US',
	),
);

// 4. Scenarios — day_offset (from today), hour, duration_minutes, customer_idx,
// booking_status, order_status, is_paid, optional order note.
$scenarios = array(
	array( -45, 9,  60, 0,  'complete',             'completed',  true,  'Customer was very satisfied.' ),
	array( -30, 14, 60, 1,  'complete',             'completed',  true,  '' ),
	array( -14, 10, 30, 2,  'complete',             'completed',  true,  'Requested a low fade.' ),
	array( -7,  11, 60, 3,  'cancelled',            'cancelled',  false, 'Customer cancelled the day before.' ),
	array( -3,  15, 60, 4,  'complete',             'completed',  true,  '' ),
	array( 2,   9,  60, 5,  'paid',                 'processing', true,  '' ),
	array( 5,   14, 60, 6,  'confirmed',            'processing', true,  '' ),
	array( 7,   10, 30, 7,  'pending-confirmation', 'pending',    false, 'Waiting on admin confirmation.' ),
	array( 10,  15, 60, 8,  'paid',                 'processing', true,  '' ),
	array( 14,  11, 60, 9,  'unpaid',               'pending',    false, '' ),
	array( 21,  16, 60, 10, 'confirmed',            'on-hold',    false, 'Holding for payment.' ),
	array( 30,  9,  60, 11, 'paid',                 'processing', true,  'First-time customer.' ),
);

$created = 0;
foreach ( $scenarios as $sc ) {
	list( $day_offset, $hour, $duration, $cust_idx, $booking_status, $order_status, $is_paid, $note ) = $sc;
	$c = $customers[ $cust_idx ];

	$start = strtotime( "today {$day_offset} days {$hour}:00:00", current_time( 'timestamp' ) );
	$end   = $start + ( $duration * 60 );

	$order = wc_create_order();
	$order->set_billing_first_name( $c['first'] );
	$order->set_billing_last_name( $c['last'] );
	$order->set_billing_email( $c['email'] );
	$order->set_billing_phone( $c['phone'] );
	$order->set_billing_address_1( $c['addr'] );
	$order->set_billing_city( $c['city'] );
	$order->set_billing_state( $c['state'] );
	$order->set_billing_postcode( $c['postcode'] );
	$order->set_billing_country( $c['country'] );
	$order->add_product( $product, 1 );
	if ( $note ) {
		$order->add_order_note( $note );
	}
	$order->calculate_totals();

	if ( $is_paid ) {
		// Set date_paid manually — `payment_complete()` fires hooks that
		// could trigger customer emails on the dev site.
		$paid_ts = $start - DAY_IN_SECONDS;
		$order->set_date_paid( $paid_ts );
		$order->set_status( $order_status );
	} else {
		$order->set_status( $order_status );
	}
	$order->save();

	$booking = new WC_Booking();
	$booking->set_product_id( $product->get_id() );
	$booking->set_order_id( $order->get_id() );
	$booking->set_customer_id( 0 );
	$booking->set_start( $start );
	$booking->set_end( $end );
	$booking->set_all_day( false );
	$booking->set_cost( $product->get_price() );
	$booking->set_status( $booking_status );
	$booking->save();

	WP_CLI::log( sprintf(
		'  booking #%d → order #%d  %s  %s  %s',
		$booking->get_id(),
		$order->get_id(),
		$booking_status,
		gmdate( 'Y-m-d H:i', $start ),
		$c['first'] . ' ' . $c['last']
	) );
	++$created;
}

WP_CLI::success( "Created {$created} bookings with attached orders." );
