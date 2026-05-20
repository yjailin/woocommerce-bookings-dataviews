<?php
/**
 * Seed a larger volume of order-backed bookings across the customer
 * pool, dates, and statuses — for filling out the list page with
 * realistic data after the fake-data delete pass.
 *
 * Run:
 *   npx wp-env run cli wp eval-file wp-content/plugins/woocommerce-bookings-dataviews/scripts/seed-bulk-bookings.php
 */

if ( ! function_exists( 'wc_create_order' ) || ! class_exists( 'WC_Booking' ) ) {
	WP_CLI::error( 'WooCommerce + Bookings must be active.' );
}

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
	WP_CLI::error( 'No bookable products found.' );
}
$product = wc_get_product( $ids[0] );

$customers = array(
	array( 'first' => 'Sophie',    'last' => 'Anderson',  'email' => 'sophie.anderson@example.com',  'phone' => '+1 503-555-1234', 'addr' => '1234 Maple Street',     'city' => 'Portland',      'state' => 'OR', 'postcode' => '97201', 'country' => 'US' ),
	array( 'first' => 'James',     'last' => 'Patel',     'email' => 'james.patel@example.com',      'phone' => '+1 206-555-2345', 'addr' => '5678 Oak Avenue',       'city' => 'Seattle',       'state' => 'WA', 'postcode' => '98101', 'country' => 'US' ),
	array( 'first' => 'Emma',      'last' => 'Garcia',    'email' => 'emma.garcia@example.com',      'phone' => '+1 415-555-3456', 'addr' => '910 Pine Road',         'city' => 'San Francisco', 'state' => 'CA', 'postcode' => '94102', 'country' => 'US' ),
	array( 'first' => 'Liam',      'last' => 'Nguyen',    'email' => 'liam.nguyen@example.com',      'phone' => '+1 212-555-4567', 'addr' => '321 Elm Boulevard',     'city' => 'New York',      'state' => 'NY', 'postcode' => '10001', 'country' => 'US' ),
	array( 'first' => 'Olivia',    'last' => 'Lee',       'email' => 'olivia.lee@example.com',       'phone' => '+1 312-555-5678', 'addr' => '654 Cedar Lane',        'city' => 'Chicago',       'state' => 'IL', 'postcode' => '60601', 'country' => 'US' ),
	array( 'first' => 'Noah',      'last' => 'Martin',    'email' => 'noah.martin@example.com',      'phone' => '+1 617-555-6789', 'addr' => '987 Birch Court',       'city' => 'Boston',        'state' => 'MA', 'postcode' => '02108', 'country' => 'US' ),
	array( 'first' => 'Ava',       'last' => 'Wilson',    'email' => 'ava.wilson@example.com',       'phone' => '+1 305-555-7890', 'addr' => '147 Walnut Way',        'city' => 'Miami',         'state' => 'FL', 'postcode' => '33101', 'country' => 'US' ),
	array( 'first' => 'Mateo',     'last' => 'Rodriguez', 'email' => 'mateo.rodriguez@example.com',  'phone' => '+1 512-555-8901', 'addr' => '258 Aspen Place',       'city' => 'Austin',        'state' => 'TX', 'postcode' => '78701', 'country' => 'US' ),
	array( 'first' => 'Isabella',  'last' => 'Chen',      'email' => 'isabella.chen@example.com',    'phone' => '+1 213-555-9012', 'addr' => '369 Willow Drive',      'city' => 'Los Angeles',   'state' => 'CA', 'postcode' => '90001', 'country' => 'US' ),
	array( 'first' => 'Ethan',     'last' => 'Hassan',    'email' => 'ethan.hassan@example.com',     'phone' => '+1 720-555-0123', 'addr' => '741 Spruce Trail',      'city' => 'Denver',        'state' => 'CO', 'postcode' => '80202', 'country' => 'US' ),
	array( 'first' => 'Mia',       'last' => 'Kowalski',  'email' => 'mia.kowalski@example.com',     'phone' => '+1 612-555-1230', 'addr' => '852 Sycamore Parkway',  'city' => 'Minneapolis',   'state' => 'MN', 'postcode' => '55401', 'country' => 'US' ),
	array( 'first' => 'Lucas',     'last' => 'Dubois',    'email' => 'lucas.dubois@example.com',     'phone' => '+1 504-555-2340', 'addr' => '963 Magnolia Avenue',   'city' => 'New Orleans',   'state' => 'LA', 'postcode' => '70112', 'country' => 'US' ),
	array( 'first' => 'Zara',      'last' => 'Okafor',    'email' => 'zara.okafor@example.com',      'phone' => '+1 215-555-3451', 'addr' => '74 Hickory Street',     'city' => 'Philadelphia',  'state' => 'PA', 'postcode' => '19102', 'country' => 'US' ),
	array( 'first' => 'Hiro',      'last' => 'Tanaka',    'email' => 'hiro.tanaka@example.com',      'phone' => '+1 808-555-4562', 'addr' => '258 Coral Way',         'city' => 'Honolulu',      'state' => 'HI', 'postcode' => '96813', 'country' => 'US' ),
	array( 'first' => 'Aaliyah',   'last' => 'Reyes',     'email' => 'aaliyah.reyes@example.com',    'phone' => '+1 480-555-5673', 'addr' => '369 Saguaro Drive',     'city' => 'Phoenix',       'state' => 'AZ', 'postcode' => '85003', 'country' => 'US' ),
	array( 'first' => 'Oscar',     'last' => 'Lindgren',  'email' => 'oscar.lindgren@example.com',   'phone' => '+1 503-555-6784', 'addr' => '852 Fjord Lane',        'city' => 'Salem',         'state' => 'OR', 'postcode' => '97301', 'country' => 'US' ),
);

$order_status_pool   = array( 'completed', 'completed', 'completed', 'processing', 'processing', 'pending', 'on-hold' );
$booking_status_pool = array( 'paid', 'complete', 'confirmed', 'pending-confirmation', 'unpaid' );

$notes = array(
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

$created = 0;
$target  = 36;

mt_srand( 4242 );

for ( $i = 0; $i < $target; $i++ ) {
	$cust = $customers[ array_rand( $customers ) ];

	// Spread evenly across [-60 .. +60] days, biased lightly toward
	// future bookings to populate the Upcoming tab.
	$day_offset = mt_rand( -60, 70 );
	$hour       = mt_rand( 8, 18 );
	$duration   = array( 30, 60, 60, 90 )[ array_rand( array( 30, 60, 60, 90 ) ) ];
	$start      = strtotime( "today {$day_offset} days {$hour}:00:00", current_time( 'timestamp' ) );
	$end        = $start + ( $duration * 60 );
	$is_past    = $start < current_time( 'timestamp' );

	$order_status   = $order_status_pool[ array_rand( $order_status_pool ) ];
	$booking_status = $booking_status_pool[ array_rand( $booking_status_pool ) ];
	$is_paid        = in_array( $booking_status, array( 'paid', 'complete' ), true );
	if ( ! $is_past && 'complete' === $booking_status ) {
		// Future bookings can't be "complete".
		$booking_status = 'confirmed';
	}

	$order = wc_create_order();
	$order->set_billing_first_name( $cust['first'] );
	$order->set_billing_last_name( $cust['last'] );
	$order->set_billing_email( $cust['email'] );
	$order->set_billing_phone( $cust['phone'] );
	$order->set_billing_address_1( $cust['addr'] );
	$order->set_billing_city( $cust['city'] );
	$order->set_billing_state( $cust['state'] );
	$order->set_billing_postcode( $cust['postcode'] );
	$order->set_billing_country( $cust['country'] );
	$order->add_product( $product, 1 );
	$order->calculate_totals();
	if ( $is_paid ) {
		$order->set_date_paid( $start - DAY_IN_SECONDS );
	}
	$order->set_status( $order_status );
	$order->save();

	$order->add_order_note( $notes[ array_rand( $notes ) ] );

	$booking = new WC_Booking();
	$booking->set_product_id( $product->get_id() );
	$booking->set_order_id( $order->get_id() );
	$booking->set_customer_id( 0 );
	$booking->set_start( $start );
	$booking->set_end( $end );
	$booking->set_all_day( false );
	$booking->set_cost( $product->get_price() );
	$booking->set_status( $booking_status );

	// Set attendance on past bookings — about 1 in 4 are unattended
	// (no-show), the rest attended. Future bookings keep the core
	// default and the detail view hides the badge.
	if ( $is_past ) {
		$booking->set_attendance_status(
			mt_rand( 1, 4 ) === 1 ? 'unattended' : 'attended'
		);
	}
	$booking->save();

	++$created;
}

WP_CLI::success( "Created {$created} additional realistic bookings." );
