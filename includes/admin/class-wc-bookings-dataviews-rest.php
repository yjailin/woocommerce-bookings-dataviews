<?php
/**
 * WC_Bookings_DataViews_REST class.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_DataViews_REST' ) ) {
	return;
}

/**
 * REST endpoint for the DataViews bookings screen.
 *
 * GET  /wc-bookings/v1/dataviews/bookings
 * GET  /wc-bookings/v1/dataviews/bookings/(?P<id>\d+)
 * GET  /wc-bookings/v1/dataviews/statuses
 * GET  /wc-bookings/v1/dataviews/filter-options
 * POST /wc-bookings/v1/dataviews/bookings/confirm
 * POST /wc-bookings/v1/dataviews/bookings/cancel
 * POST /wc-bookings/v1/dataviews/bookings/mark-paid
 * POST /wc-bookings/v1/dataviews/bookings/mark-attended
 * POST /wc-bookings/v1/dataviews/bookings/mark-unattended
 */
class WC_Bookings_DataViews_REST {

	const NAMESPACE = 'wc-bookings/v1';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register' ) );
	}

	/**
	 * Register REST routes.
	 */
	public function register() {
		$capability_check = function () {
			return current_user_can( 'edit_wc_bookings' ); // phpcs:ignore WordPress.WP.Capabilities.Unknown
		};

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings',
			array(
				'methods'             => 'GET',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'get_bookings' ),
				'args'                => array(
					'page'        => array(
						'default'           => 1,
						'sanitize_callback' => 'absint',
					),
					'per_page'    => array(
						'default'           => 20,
						'sanitize_callback' => 'absint',
					),
					'search'      => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'orderby'     => array(
						'default'           => 'booking_id',
						'sanitize_callback' => 'sanitize_key',
					),
					'order'       => array(
						'default'           => 'desc',
						'sanitize_callback' => 'sanitize_key',
					),
					'status'      => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'product'     => array(
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'resource'    => array(
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'start_range' => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'end_range'   => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'tab'         => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
					'attendance'  => array(
						'default'           => '',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/statuses',
			array(
				'methods'             => 'GET',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'get_statuses' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/filter-options',
			array(
				'methods'             => 'GET',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'get_filter_options' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/confirm',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'confirm_bookings' ),
				'args'                => array(
					'ids' => array(
						'required' => true,
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/cancel',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'cancel_bookings' ),
				'args'                => array(
					'ids' => array(
						'required' => true,
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/mark-paid',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'mark_paid_bookings' ),
				'args'                => array(
					'ids' => array(
						'required' => true,
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/mark-attended',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'mark_attended_bookings' ),
				'args'                => array(
					'ids' => array(
						'required' => true,
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/mark-unattended',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'mark_unattended_bookings' ),
				'args'                => array(
					'ids' => array(
						'required' => true,
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'get_booking' ),
				'args'                => array(
					'id' => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Mark bookings as paid.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function mark_paid_bookings( WP_REST_Request $request ) {
		$ids     = array_map( 'absint', array_filter( (array) $request['ids'] ) );
		$updated = array();
		foreach ( $ids as $id ) {
			try {
				$booking = new WC_Booking( $id );
			} catch ( Exception $e ) {
				continue;
			}
			if ( in_array( $booking->get_status(), array( 'paid', 'complete', 'cancelled', 'refunded' ), true ) ) {
				continue;
			}
			$booking->update_status( 'paid' );
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Mark bookings as attended.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function mark_attended_bookings( WP_REST_Request $request ) {
		$ids     = array_map( 'absint', array_filter( (array) $request['ids'] ) );
		$updated = array();
		foreach ( $ids as $id ) {
			if ( 'wc_booking' !== get_post_type( $id ) ) {
				continue;
			}
			update_post_meta( $id, '_booking_attendance_status', 'attended' );
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Mark bookings as unattended.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function mark_unattended_bookings( WP_REST_Request $request ) {
		$ids     = array_map( 'absint', array_filter( (array) $request['ids'] ) );
		$updated = array();
		foreach ( $ids as $id ) {
			if ( 'wc_booking' !== get_post_type( $id ) ) {
				continue;
			}
			update_post_meta( $id, '_booking_attendance_status', 'unattended' );
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Get a single booking with full detail.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_booking( WP_REST_Request $request ) {
		$id = (int) $request['id'];
		if ( 'wc_booking' !== get_post_type( $id ) ) {
			return new WP_Error( 'wc_bookings_dv_not_found', __( 'Booking not found.', 'woocommerce-bookings' ), array( 'status' => 404 ) );
		}
		try {
			$booking = new WC_Booking( $id );
		} catch ( Exception $e ) {
			return new WP_Error( 'wc_bookings_dv_not_found', __( 'Booking not found.', 'woocommerce-bookings' ), array( 'status' => 404 ) );
		}
		$post = get_post( $id );
		return rest_ensure_response( $this->shape_booking_detail( $booking, $post ) );
	}

	/**
	 * Shape a booking into a detailed payload for the single view.
	 *
	 * Builds on top of the list shape with extra fields the detail page needs.
	 *
	 * @param WC_Booking $booking Booking object.
	 * @param WP_Post    $post    Post object.
	 * @return array
	 */
	private function shape_booking_detail( WC_Booking $booking, WP_Post $post ) {
		$base = $this->shape_booking( $booking, $post );

		// Date helpers. We give the client both component-formatted strings
		// (so it can compose "Date · Start time - End time" without parsing
		// the locale-formatted full strings) and an is_same_day flag.
		$tz        = wp_timezone();
		$start_raw = (string) get_post_meta( $post->ID, '_booking_start', true );
		$end_raw   = (string) get_post_meta( $post->ID, '_booking_end', true );
		$start_dt  = $start_raw ? DateTimeImmutable::createFromFormat( 'YmdHis', $start_raw, $tz ) : false;
		$end_dt    = $end_raw ? DateTimeImmutable::createFromFormat( 'YmdHis', $end_raw, $tz ) : false;

		$date_format = (string) get_option( 'date_format' );
		$time_format = (string) get_option( 'time_format' );

		$base['start_date_only_display'] = $start_dt ? wp_date( $date_format, $start_dt->getTimestamp() ) : '';
		$base['start_time_display']      = $start_dt ? wp_date( $time_format, $start_dt->getTimestamp() ) : '';
		$base['end_time_display']        = $end_dt ? wp_date( $time_format, $end_dt->getTimestamp() ) : '';
		$base['is_same_day']             = ( $start_dt && $end_dt && $start_dt->format( 'Y-m-d' ) === $end_dt->format( 'Y-m-d' ) );

		// Duration for the ServiceInfo row.
		$duration_seconds         = ( $start_dt && $end_dt ) ? ( $end_dt->getTimestamp() - $start_dt->getTimestamp() ) : 0;
		$base['duration_seconds'] = $duration_seconds;
		$base['duration_display'] = self::format_duration_human( $duration_seconds );

		// Product thumbnail — extends the list shape's `product` block.
		$product = $booking->get_product();
		if ( $product && isset( $base['product'] ) && is_array( $base['product'] ) ) {
			$product_id                   = is_callable( array( $product, 'get_id' ) ) ? $product->get_id() : 0;
			$thumbnail_id                 = $product_id ? get_post_thumbnail_id( $product_id ) : 0;
			$thumbnail                    = $thumbnail_id ? wp_get_attachment_image_src( $thumbnail_id, 'thumbnail' ) : null;
			$base['product']['thumbnail'] = $thumbnail ? $thumbnail[0] : '';
		}

		// Customer phone / extra details.
		$customer = $booking->get_customer();
		if ( isset( $base['customer'] ) && is_array( $base['customer'] ) ) {
			$base['customer']['phone']   = isset( $customer->phone ) ? $customer->phone : '';
			$base['customer']['user_id'] = isset( $customer->user_id ) ? (int) $customer->user_id : 0;
		}

		// Booking flags / extras.
		$base['all_day']  = (bool) get_post_meta( $post->ID, '_booking_all_day', true );
		$base['note']     = (string) $post->post_excerpt;
		$base['date_created'] = mysql_to_rfc3339( $post->post_date_gmt );

		// Order / payment.
		$order_id = (int) get_post_meta( $post->ID, '_booking_order_item_id', true );
		$order    = $booking->get_order();
		if ( $order ) {
			$base['order']['status']       = $order->get_status();
			$base['order']['status_label'] = wc_get_order_status_name( $order->get_status() );
			$base['order']['date_paid']    = $order->get_date_paid() ? $order->get_date_paid()->date( DATE_ATOM ) : null;
			$base['order']['total']        = (float) $order->get_total();
			$base['order']['total_display'] = html_entity_decode( wp_strip_all_tags( wc_price( (float) $order->get_total() ) ), ENT_QUOTES, 'UTF-8' );
			$base['order']['currency']     = $order->get_currency();
		}

		// Capability flags that drive button visibility on the client.
		$base['can'] = array(
			'cancel'           => ! in_array( $booking->get_status(), array( 'cancelled', 'complete' ), true ),
			'mark_paid'        => ! in_array( $booking->get_status(), array( 'paid', 'complete', 'cancelled', 'refunded' ), true ),
			'mark_attended'    => ! empty( $base['is_past'] ) && 'attended' !== $base['attendance_status'],
			'mark_unattended'  => ! empty( $base['is_past'] ) && 'unattended' !== $base['attendance_status'],
			'view_order'       => ! empty( $base['order'] ),
		);

		return $base;
	}

	/**
	 * Confirm bookings.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function confirm_bookings( WP_REST_Request $request ) {
		$ids     = array_map( 'absint', array_filter( (array) $request['ids'] ) );
		$updated = array();
		foreach ( $ids as $id ) {
			try {
				$booking = new WC_Booking( $id );
			} catch ( Exception $e ) {
				continue;
			}
			if ( 'pending-confirmation' !== $booking->get_status() ) {
				continue;
			}
			$booking->update_status( 'confirmed' );
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Cancel bookings.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function cancel_bookings( WP_REST_Request $request ) {
		$ids     = array_map( 'absint', array_filter( (array) $request['ids'] ) );
		$updated = array();
		foreach ( $ids as $id ) {
			try {
				$booking = new WC_Booking( $id );
			} catch ( Exception $e ) {
				continue;
			}
			if ( 'cancelled' === $booking->get_status() ) {
				continue;
			}
			$booking->update_status( 'cancelled' );
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Format a duration in seconds as a short human-readable string —
	 * "1 hour 30 minutes", "45 minutes", etc. Used by the booking detail
	 * page's ServiceInfo row.
	 *
	 * @param int $seconds Duration in seconds.
	 * @return string
	 */
	private static function format_duration_human( $seconds ) {
		$seconds = (int) $seconds;
		if ( $seconds <= 0 ) {
			return '';
		}
		$hours   = (int) floor( $seconds / 3600 );
		$minutes = (int) floor( ( $seconds % 3600 ) / 60 );
		$parts   = array();
		if ( $hours > 0 ) {
			/* translators: %d: number of hours */
			$parts[] = sprintf( _n( '%d hour', '%d hours', $hours, 'woocommerce-bookings' ), $hours );
		}
		if ( $minutes > 0 ) {
			/* translators: %d: number of minutes */
			$parts[] = sprintf( _n( '%d minute', '%d minutes', $minutes, 'woocommerce-bookings' ), $minutes );
		}
		return implode( ' ', $parts );
	}

	/**
	 * Convert a preset key ("today", "this_week"…) into a pair of
	 * YmdHis strings suitable for comparing against _booking_start /
	 * _booking_end meta values.
	 *
	 * @param string $preset Preset key.
	 * @return array{0:string,1:string}|null
	 */
	public static function preset_to_range( $preset ) {
		$tz  = wp_timezone();
		$now = new DateTimeImmutable( 'now', $tz );

		switch ( $preset ) {
			case 'today':
				$from = $now->setTime( 0, 0, 0 );
				$to   = $now->setTime( 23, 59, 59 );
				break;
			case 'tomorrow':
				$t    = $now->modify( '+1 day' );
				$from = $t->setTime( 0, 0, 0 );
				$to   = $t->setTime( 23, 59, 59 );
				break;
			case 'this_week':
				$start_of_week = (int) get_option( 'start_of_week', 1 );
				$dow           = (int) $now->format( 'w' );
				$offset        = ( $dow - $start_of_week + 7 ) % 7;
				$from          = $now->modify( "-$offset days" )->setTime( 0, 0, 0 );
				$to            = $from->modify( '+6 days' )->setTime( 23, 59, 59 );
				break;
			case 'this_month':
				$from = $now->modify( 'first day of this month' )->setTime( 0, 0, 0 );
				$to   = $now->modify( 'last day of this month' )->setTime( 23, 59, 59 );
				break;
			case 'upcoming':
				$from = $now;
				$to   = $now->modify( '+10 years' );
				break;
			case 'past_30':
				$from = $now->modify( '-30 days' )->setTime( 0, 0, 0 );
				$to   = $now;
				break;
			case 'next_30':
				$from = $now;
				$to   = $now->modify( '+30 days' )->setTime( 23, 59, 59 );
				break;
			default:
				return null;
		}

		return array( $from->format( 'YmdHis' ), $to->format( 'YmdHis' ) );
	}

	/**
	 * Get filter options (products and resources).
	 *
	 * @return WP_REST_Response
	 */
	public function get_filter_options() {
		$products_list = array();
		$resources_map = array();

		if ( class_exists( 'WC_Bookings_Admin' ) ) {
			$products = WC_Bookings_Admin::get_booking_products();
			foreach ( $products as $product ) {
				$products_list[] = array(
					'value' => $product->get_id(),
					'label' => $product->get_name(),
				);
				foreach ( $product->get_resources() as $resource ) {
					$resources_map[ $resource->get_id() ] = $resource->get_name();
				}
			}
		}

		$resources_list = array();
		foreach ( $resources_map as $id => $name ) {
			$resources_list[] = array(
				'value' => $id,
				'label' => $name,
			);
		}

		return rest_ensure_response(
			array(
				'products'  => $products_list,
				'resources' => $resources_list,
			)
		);
	}

	/**
	 * Get booking statuses.
	 *
	 * @return WP_REST_Response
	 */
	public function get_statuses() {
		$statuses = function_exists( 'get_wc_booking_statuses' )
			? get_wc_booking_statuses( 'user' )
			: array();
		$out      = array();
		foreach ( $statuses as $key ) {
			$out[] = array(
				'value' => $key,
				'label' => function_exists( 'wc_bookings_get_status_label' ) ? wc_bookings_get_status_label( $key ) : $key,
			);
		}
		return rest_ensure_response( $out );
	}

	/**
	 * Get bookings list.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_bookings( WP_REST_Request $request ) {
		$page        = max( 1, (int) $request['page'] );
		$per_page    = min( 100, max( 1, (int) $request['per_page'] ) );
		$search      = (string) $request['search'];
		$orderby     = (string) $request['orderby'];
		$order       = 'ASC' === strtoupper( (string) $request['order'] ) ? 'ASC' : 'DESC';
		$status      = (string) $request['status'];
		$product     = (int) $request['product'];
		$resource    = (int) $request['resource'];
		$start_range = (string) $request['start_range'];
		$end_range   = (string) $request['end_range'];
		$tab         = (string) $request['tab'];
		$attendance  = (string) $request['attendance'];

		$args = array(
			'post_type'      => 'wc_booking',
			'post_status'    => $status ? array( $status ) : 'any',
			'posts_per_page' => $per_page,
			'paged'          => $page,
		);

		$meta_query = array(); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query

		// Handle search. The default WP 's' parameter searches only
		// post_title/post_content, which is useless for bookings.
		// Instead, collect candidate booking IDs from every searchable
		// surface (customer, product, resource, order number, booking
		// number) and constrain the query with post__in.
		if ( '' !== $search ) {
			$matched_ids = array();
			$is_numeric  = ctype_digit( $search );

			// Booking ID match.
			if ( $is_numeric ) {
				$candidate = get_post( (int) $search );
				if ( $candidate && 'wc_booking' === $candidate->post_type ) {
					$matched_ids[] = (int) $search;
				}
			}

			// Customer match (login / email / display name / nicename).
			$user_ids = get_users(
				array(
					'search'         => '*' . esc_attr( $search ) . '*',
					'search_columns' => array( 'user_login', 'user_email', 'display_name', 'user_nicename' ),
					'fields'         => 'ID',
				)
			);
			if ( ! empty( $user_ids ) ) {
				$matched_ids = array_merge(
					$matched_ids,
					get_posts(
						array(
							'post_type'      => 'wc_booking',
							'post_status'    => 'any',
							'posts_per_page' => -1,
							'fields'         => 'ids',
							// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							'meta_query'     => array(
								array(
									'key'     => '_booking_customer_id',
									'value'   => $user_ids,
									'compare' => 'IN',
								),
							),
						)
					)
				);
			}

			// Product name match.
			$product_ids = get_posts(
				array(
					'post_type'      => 'product',
					'post_status'    => 'any',
					'posts_per_page' => -1,
					'fields'         => 'ids',
					's'              => $search,
				)
			);
			if ( ! empty( $product_ids ) ) {
				$matched_ids = array_merge(
					$matched_ids,
					get_posts(
						array(
							'post_type'      => 'wc_booking',
							'post_status'    => 'any',
							'posts_per_page' => -1,
							'fields'         => 'ids',
							// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							'meta_query'     => array(
								array(
									'key'     => '_booking_product_id',
									'value'   => $product_ids,
									'compare' => 'IN',
								),
							),
						)
					)
				);
			}

			// Resource name match (bookable_resource is the WC Bookings CPT).
			$resource_ids = get_posts(
				array(
					'post_type'      => 'bookable_resource',
					'post_status'    => 'any',
					'posts_per_page' => -1,
					'fields'         => 'ids',
					's'              => $search,
				)
			);
			if ( ! empty( $resource_ids ) ) {
				$matched_ids = array_merge(
					$matched_ids,
					get_posts(
						array(
							'post_type'      => 'wc_booking',
							'post_status'    => 'any',
							'posts_per_page' => -1,
							'fields'         => 'ids',
							// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							'meta_query'     => array(
								array(
									'key'     => '_booking_resource_id',
									'value'   => $resource_ids,
									'compare' => 'IN',
								),
							),
						)
					)
				);
			}

			// Order number match (numeric only — parent order ID).
			if ( $is_numeric ) {
				$matched_ids = array_merge(
					$matched_ids,
					get_posts(
						array(
							'post_type'      => 'wc_booking',
							'post_status'    => 'any',
							'posts_per_page' => -1,
							'fields'         => 'ids',
							'post_parent'    => (int) $search,
						)
					)
				);
			}

			$matched_ids = array_values( array_unique( array_map( 'intval', $matched_ids ) ) );

			// post__in with an empty array would behave as "no filter",
			// so use [0] when nothing matched, which is a guaranteed miss.
			$args['post__in'] = empty( $matched_ids ) ? array( 0 ) : $matched_ids;
		}

		if ( $product ) {
			$meta_query[] = array(
				'key'   => '_booking_product_id',
				'value' => $product,
			);
		}

		if ( $resource ) {
			$meta_query[] = array(
				'key'   => '_booking_resource_id',
				'value' => $resource,
			);
		}

		// Attendance filter. The UI shows past bookings as "Attended"
		// unless explicitly flagged unattended, so the filter mirrors
		// that visual rule rather than just doing a literal meta match.
		if ( 'attended' === $attendance ) {
			$now_ymd = ( new DateTimeImmutable( 'now', wp_timezone() ) )->format( 'YmdHis' );
			$meta_query[] = array(
				'relation' => 'OR',
				array(
					'key'   => '_booking_attendance_status',
					'value' => 'attended',
				),
				array(
					'relation' => 'AND',
					array(
						'key'     => '_booking_end',
						'value'   => $now_ymd,
						'compare' => '<',
					),
					array(
						'relation' => 'OR',
						array(
							'key'     => '_booking_attendance_status',
							'compare' => 'NOT EXISTS',
						),
						array(
							'key'     => '_booking_attendance_status',
							'value'   => 'unattended',
							'compare' => '!=',
						),
					),
				),
			);
		} elseif ( 'unattended' === $attendance ) {
			$meta_query[] = array(
				'key'   => '_booking_attendance_status',
				'value' => 'unattended',
			);
		}

		if ( $start_range ) {
			$range = self::preset_to_range( $start_range );
			if ( $range ) {
				$meta_query[] = array(
					'key'     => '_booking_start',
					'value'   => array( $range[0], $range[1] ),
					'compare' => 'BETWEEN',
				);
			}
		}

		if ( $end_range ) {
			$range = self::preset_to_range( $end_range );
			if ( $range ) {
				$meta_query[] = array(
					'key'     => '_booking_end',
					'value'   => array( $range[0], $range[1] ),
					'compare' => 'BETWEEN',
				);
			}
		}

		if ( $tab ) {
			$tz             = wp_timezone();
			$now            = new DateTimeImmutable( 'now', $tz );
			$start_of_today = $now->setTime( 0, 0, 0 )->format( 'YmdHis' );
			$end_of_today   = $now->setTime( 23, 59, 59 )->format( 'YmdHis' );

			switch ( $tab ) {
				case 'today':
					$meta_query[] = array(
						'key'     => '_booking_start',
						'value'   => $end_of_today,
						'compare' => '<=',
					);
					$meta_query[] = array(
						'key'     => '_booking_end',
						'value'   => $start_of_today,
						'compare' => '>=',
					);
					break;
				case 'upcoming':
					$meta_query[] = array(
						'key'     => '_booking_start',
						'value'   => $end_of_today,
						'compare' => '>',
					);
					break;
				case 'past':
					$meta_query[] = array(
						'key'     => '_booking_end',
						'value'   => $start_of_today,
						'compare' => '<',
					);
					break;
				case 'canceled':
					$args['post_status'] = array( 'cancelled' );
					break;
				case 'all':
				default:
					break;
			}

			if ( in_array( $tab, array( 'today', 'upcoming', 'past' ), true ) ) {
				$default_statuses    = array( 'unpaid', 'pending-confirmation', 'confirmed', 'paid', 'complete' );
				$args['post_status'] = $status ? array( $status ) : $default_statuses;
			}
		}

		if ( $meta_query ) {
			$args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		switch ( $orderby ) {
			case 'start_date':
				$args['meta_key'] = '_booking_start'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				$args['orderby']  = 'meta_value';
				$args['order']    = $order;
				break;
			case 'end_date':
				$args['meta_key'] = '_booking_end'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				$args['orderby']  = 'meta_value';
				$args['order']    = $order;
				break;
			case 'booked_product':
				$args['meta_key'] = '_booking_product_id'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				$args['orderby']  = 'meta_value_num';
				$args['order']    = $order;
				break;
			case 'total':
				$args['meta_key'] = '_booking_cost'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				$args['orderby']  = 'meta_value_num';
				$args['order']    = $order;
				break;
			case 'booking_id':
			default:
				$args['orderby'] = 'ID';
				$args['order']   = $order;
				break;
		}

		$query = new WP_Query( $args );
		$items = array();
		foreach ( $query->posts as $post ) {
			try {
				$booking = new WC_Booking( $post->ID );
			} catch ( Exception $e ) {
				continue;
			}
			$items[] = $this->shape_booking( $booking, $post );
		}

		return rest_ensure_response(
			array(
				'items'       => $items,
				'total_items' => (int) $query->found_posts,
				'total_pages' => (int) $query->max_num_pages,
			)
		);
	}

	/**
	 * Shape a booking into an array for the REST response.
	 *
	 * @param WC_Booking $booking Booking object.
	 * @param WP_Post    $post    Post object.
	 * @return array
	 */
	private function shape_booking( WC_Booking $booking, WP_Post $post ) {
		$product  = $booking->get_product();
		$resource = $booking->get_resource();
		$order    = $booking->get_order();
		$customer = $booking->get_customer();

		$product_data = null;
		if ( $product ) {
			$product_id   = is_callable( array( $product, 'get_id' ) ) ? $product->get_id() : ( isset( $product->id ) ? $product->id : 0 );
			$product_data = array(
				'id'       => $product_id,
				'title'    => $product->get_title(),
				'edit_url' => admin_url( 'post.php?post=' . $product_id . '&action=edit' ),
			);
			if ( $resource ) {
				$product_data['resource'] = array(
					'id'       => $resource->get_id(),
					'name'     => $resource->get_name(),
					'edit_url' => admin_url( 'post.php?post=' . $resource->get_id() . '&action=edit' ),
				);
			}
		}

		$person_counts = $booking->get_person_counts();
		$num_persons   = ! empty( $person_counts ) ? (int) array_sum( $person_counts ) : null;
		$attendance    = $booking->get_attendance_status();
		$cost          = (float) $booking->get_cost();
		$end           = (string) get_post_meta( $post->ID, '_booking_end', true );
		$start         = (string) get_post_meta( $post->ID, '_booking_start', true );
		$now           = ( new DateTimeImmutable( 'now', wp_timezone() ) )->format( 'YmdHis' );

		return array(
			'id'                      => $post->ID,
			'edit_url'                => admin_url( 'post.php?post=' . $post->ID . '&action=edit' ),
			'detail_url'              => admin_url( 'edit.php?post_type=wc_booking&page=' . WC_Bookings_DataViews_Page::PAGE_SLUG . '&booking=' . $post->ID ),
			'total'                   => $cost,
			'total_display'           => html_entity_decode( wp_strip_all_tags( wc_price( $cost ) ), ENT_QUOTES, 'UTF-8' ),
			'is_past'                 => ( '' !== $end && $end < $now ),
			'is_today'                => ( '' !== $start && '' !== $end && $start <= $now && $end >= $now ),
			'status'                  => $booking->get_status(),
			'status_label'            => function_exists( 'wc_bookings_get_status_label' ) ? wc_bookings_get_status_label( $booking->get_status() ) : $booking->get_status(),
			'attendance_status'       => $attendance ? $attendance : null,
			'attendance_status_label' => $attendance ? ( 'attended' === $attendance ? __( 'Attended', 'woocommerce-bookings' ) : __( 'Unattended', 'woocommerce-bookings' ) ) : null,
			'product'                 => $product_data,
			'num_of_persons'          => $num_persons,
			'customer'                => array(
				'name'  => isset( $customer->name ) ? $customer->name : '',
				'email' => isset( $customer->email ) ? $customer->email : '',
			),
			'order'                   => $order ? array(
				'id'       => $order->get_id(),
				'number'   => $order->get_order_number(),
				'edit_url' => $order->get_edit_order_url(),
			) : null,
			'start_date'              => $booking->get_start_date(),
			'end_date'                => $booking->get_end_date(),
		);
	}
}
