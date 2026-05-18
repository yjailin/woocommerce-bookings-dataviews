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
 * GET  /wc-bookings/v1/dataviews/products/(?P<id>\d+)/availability
 * POST /wc-bookings/v1/dataviews/bookings/confirm
 * POST /wc-bookings/v1/dataviews/bookings/cancel
 * POST /wc-bookings/v1/dataviews/bookings/mark-paid
 * POST /wc-bookings/v1/dataviews/bookings/mark-attended
 * POST /wc-bookings/v1/dataviews/bookings/mark-unattended
 * POST /wc-bookings/v1/dataviews/bookings/(?P<id>\d+)/reschedule
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
					'payment_status' => array(
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

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/update',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'update_booking' ),
				'args'                => array(
					'id'     => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'fields' => array(
						'required' => true,
						'type'     => 'object',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/products/(?P<id>\d+)/availability',
			array(
				'methods'             => 'GET',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'get_product_availability' ),
				'args'                => array(
					'id'              => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'start_date'      => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'end_date'        => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'resource_id'     => array(
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
					'timezone_offset' => array(
						'default' => 0,
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/dataviews/bookings/(?P<id>\d+)/reschedule',
			array(
				'methods'             => 'POST',
				'permission_callback' => $capability_check,
				'callback'            => array( $this, 'reschedule_booking' ),
				'args'                => array(
					'id'          => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'start'       => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'end'         => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'resource_id' => array(
						'default'           => 0,
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
			if ( in_array( $booking->get_status(), array( 'paid', 'cancelled', 'refunded' ), true ) ) {
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
			// Go through the WC_Booking setter + save so the data store
			// invalidates its object cache. A direct `update_post_meta()`
			// would persist the value but leave the cached booking object
			// stale, causing subsequent reads (including the page's
			// refresh-after-action) to return the old attendance.
			$booking = get_wc_booking( $id );
			if ( ! $booking ) {
				continue;
			}
			$booking->set_attendance_status( 'attended' );
			$booking->save();
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
			// Go through the WC_Booking setter + save (see mark_attended).
			$booking = get_wc_booking( $id );
			if ( ! $booking ) {
				continue;
			}
			$booking->set_attendance_status( 'unattended' );
			$booking->save();
			$updated[] = $id;
		}
		return rest_ensure_response( array( 'updated' => $updated ) );
	}

	/**
	 * Update a booking's editable fields in one shot. Accepts `{ fields:
	 * { note?, ... } }` and applies each known field via its proper
	 * setter, then returns the refreshed booking detail shape so the
	 * client can rehydrate from the response (no follow-up GET).
	 *
	 * Future editable fields go here; for each new key, add a
	 * `case 'foo'` branch with the right setter / save call.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_booking( WP_REST_Request $request ) {
		$id = absint( $request['id'] );
		if ( 'wc_booking' !== get_post_type( $id ) ) {
			return new WP_Error(
				'wc_bookings_dv_not_found',
				__( 'Booking not found.', 'woocommerce-bookings' ),
				array( 'status' => 404 )
			);
		}

		$fields = (array) $request['fields'];
		$order  = null;
		foreach ( $fields as $key => $value ) {
			switch ( $key ) {
				case 'note':
					$result = wp_update_post(
						array(
							'ID'           => $id,
							'post_excerpt' => wp_kses_post( (string) $value ),
						),
						true
					);
					if ( is_wp_error( $result ) ) {
						return $result;
					}
					break;
				case 'billing':
					if ( ! is_array( $value ) ) {
						break;
					}
					if ( null === $order ) {
						$b     = get_wc_booking( $id );
						$order = $b && $b->get_order_id()
							? wc_get_order( $b->get_order_id() )
							: null;
					}
					if ( ! $order ) {
						return new WP_Error(
							'wc_bookings_dv_no_order',
							__( 'This booking has no order to update.', 'woocommerce-bookings' ),
							array( 'status' => 400 )
						);
					}
					$setters = array(
						'first_name',
						'last_name',
						'company',
						'address_1',
						'address_2',
						'city',
						'state',
						'postcode',
						'country',
						'phone',
					);
					foreach ( $setters as $bkey ) {
						if ( array_key_exists( $bkey, $value ) ) {
							$setter = "set_billing_$bkey";
							$order->$setter( sanitize_text_field( (string) $value[ $bkey ] ) );
						}
					}
					if ( array_key_exists( 'email', $value ) ) {
						$order->set_billing_email( sanitize_email( (string) $value['email'] ) );
					}
					$order->save();
					break;
				// Add new editable fields here.
			}
		}

		$booking = get_wc_booking( $id );
		$post    = get_post( $id );
		if ( ! $booking || ! $post ) {
			return new WP_Error(
				'wc_bookings_dv_not_found',
				__( 'Booking not found.', 'woocommerce-bookings' ),
				array( 'status' => 404 )
			);
		}
		return rest_ensure_response(
			$this->shape_booking_detail( $booking, $post )
		);
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

		$all_day = (bool) get_post_meta( $post->ID, '_booking_all_day', true );

		// Duration for the ServiceInfo row. All-day bookings always span the
		// full 00:00-23:59 range internally, so reporting "23 hours 59 minutes"
		// would leak that detail — show day-granular text instead, matching
		// how core WC Bookings handles all-day everywhere else.
		$duration_seconds         = ( $start_dt && $end_dt ) ? ( $end_dt->getTimestamp() - $start_dt->getTimestamp() ) : 0;
		$base['duration_seconds'] = $duration_seconds;
		if ( $all_day && $start_dt && $end_dt ) {
			$days = (int) $start_dt->setTime( 0, 0, 0 )->diff( $end_dt->setTime( 0, 0, 0 ) )->days + 1;
			if ( $days <= 1 ) {
				$base['duration_display'] = __( 'All day', 'woocommerce-bookings' );
			} else {
				/* translators: %d: number of days */
				$base['duration_display'] = sprintf( _n( '%d day', '%d days', $days, 'woocommerce-bookings' ), $days );
			}
		} else {
			$base['duration_display'] = self::format_duration_human( $duration_seconds );
		}

		// Product thumbnail — extends the list shape's `product` block.
		$product = $booking->get_product();
		if ( $product && isset( $base['product'] ) && is_array( $base['product'] ) ) {
			$product_id                   = is_callable( array( $product, 'get_id' ) ) ? $product->get_id() : 0;
			$thumbnail_id                 = $product_id ? get_post_thumbnail_id( $product_id ) : 0;
			$thumbnail                    = $thumbnail_id ? wp_get_attachment_image_src( $thumbnail_id, 'thumbnail' ) : null;
			$base['product']['thumbnail'] = $thumbnail ? $thumbnail[0] : '';

			// Reschedule-modal inputs. The modal needs the booking duration
			// (to compute the new end from the picked start slot) and the
			// full list of selectable resources for the team-member
			// dropdown. Resources are only meaningful when the product has
			// them — empty array signals "skip the dropdown".
			$base['product']['booking_duration']      = (int) $product->get_duration();
			$base['product']['booking_duration_unit'] = (string) $product->get_duration_unit();
			$resources_list                   = array();
			if ( $product->has_resources() ) {
				foreach ( $product->get_resources() as $res ) {
					$resources_list[] = array(
						'id'   => (int) $res->get_id(),
						'name' => (string) $res->get_name(),
					);
				}
			}
			$base['product']['resources']        = $resources_list;
			$base['product']['assignment_type']  = $product->has_resources()
				? ( $product->is_resource_assignment_type( 'automatic' ) ? 'automatic' : 'customer' )
				: '';
		}

		// Customer phone (detail-only — user_id / profile_url already on base).
		$customer = $booking->get_customer();
		if ( isset( $base['customer'] ) && is_array( $base['customer'] ) ) {
			$base['customer']['phone'] = isset( $customer->phone ) ? $customer->phone : '';
		}

		// Booking flags / extras.
		$base['all_day']  = $all_day;
		$base['note']     = (string) $post->post_excerpt;
		$base['date_created'] = mysql_to_rfc3339( $post->post_date_gmt );

		// Order / payment.
		$order_id = (int) get_post_meta( $post->ID, '_booking_order_item_id', true );
		$order    = $booking->get_order();
		if ( $order ) {
			$fmt = static function ( $v ) {
				return html_entity_decode(
					wp_strip_all_tags( wc_price( (float) $v ) ),
					ENT_QUOTES,
					'UTF-8'
				);
			};

			$base['order']['status']        = $order->get_status();
			$base['order']['date_paid']     = $order->get_date_paid() ? $order->get_date_paid()->date( DATE_ATOM ) : null;
			$base['order']['total']         = (float) $order->get_total();
			$base['order']['total_display'] = $fmt( $order->get_total() );
			$base['order']['currency']      = $order->get_currency();

			// Line items + subtotal/tax/discount totals power the
			// breakdown table on the booking detail page (matches
			// CIAB's `booking-payment-dataviews` table).
			$line_items = array();
			foreach ( $order->get_items() as $item_id => $item ) {
				$line_items[] = array(
					'id'            => $item_id,
					'name'          => $item->get_name(),
					'total'         => (float) $item->get_total(),
					'total_display' => $fmt( $item->get_total() ),
				);
			}
			$base['order']['line_items']             = $line_items;
			$base['order']['subtotal']               = (float) $order->get_subtotal();
			$base['order']['subtotal_display']       = $fmt( $order->get_subtotal() );
			$base['order']['total_tax']              = (float) $order->get_total_tax();
			$base['order']['total_tax_display']      = $fmt( $order->get_total_tax() );
			$base['order']['discount_total']         = (float) $order->get_discount_total();
			$base['order']['discount_total_display'] = $fmt( $order->get_discount_total() );

			// Customer's checkout note (the message they leave at
			// checkout) — this is what CIAB surfaces under the
			// Customer card's "Note" section, not admin-side
			// `wc_get_order_notes()` entries.
			$customer_note         = (string) $order->get_customer_note();
			$base['order']['note'] = '' !== $customer_note ? $customer_note : null;

			// Billing details — powers the Billing information section
			// of the Customer card on the detail page. We ask WC to
			// format the address with `<br/>` separators (its default)
			// then split on the tag, so each line stays distinct after
			// `wp_strip_all_tags` would otherwise collapse them.
			$formatted_html = (string) $order->get_formatted_billing_address(
				'<br/>'
			);
			$formatted_lines = array_filter(
				array_map(
					static function ( $line ) {
						return trim( wp_strip_all_tags( $line ) );
					},
					preg_split( '#<br\s*/?>#i', $formatted_html )
				),
				static function ( $line ) {
					return '' !== $line;
				}
			);

			$base['order']['billing'] = array(
				'first_name'      => $order->get_billing_first_name(),
				'last_name'       => $order->get_billing_last_name(),
				'company'         => $order->get_billing_company(),
				'address_1'       => $order->get_billing_address_1(),
				'address_2'       => $order->get_billing_address_2(),
				'city'            => $order->get_billing_city(),
				'state'           => $order->get_billing_state(),
				'postcode'        => $order->get_billing_postcode(),
				'country'         => $order->get_billing_country(),
				'email'           => $order->get_billing_email(),
				'phone'           => $order->get_billing_phone(),
				'formatted_lines' => array_values( $formatted_lines ),
			);
		}

		// Capability flags that drive button visibility on the client.
		// Rules mirror the list-view isEligible logic in src/app.js,
		// derived from CIAB's row-action behavior:
		//   cancel:           allowed unless paid / completed / refunded / cancelled
		//   mark_paid:        allowed unless already paid / refunded / cancelled
		//                     ('complete' bookings can still need a missing payment recorded)
		//   mark_attended:    allowed for any non-cancelled booking that
		//                     isn't already marked attended (past or future)
		//   mark_unattended:  allowed for any non-cancelled booking that
		//                     is currently marked attended
		$base['can'] = array(
			'cancel'           => ! in_array( $booking->get_status(), array( 'cancelled', 'paid', 'complete', 'refunded' ), true ),
			'mark_paid'        => ! in_array( $booking->get_status(), array( 'paid', 'cancelled', 'refunded' ), true ),
			'mark_attended'    => 'cancelled' !== $booking->get_status() && 'attended' !== $base['attendance_status'],
			'mark_unattended'  => 'cancelled' !== $booking->get_status() && 'attended' === $base['attendance_status'],
			'view_order'       => ! empty( $base['order'] ),
			// Mirrors CIAB's reschedule isEligible. The JS side reads the
			// same gating from `isRescheduleEligible(item)`; this flag
			// drives the inline button + kebab visibility on the detail
			// page server-side.
			'reschedule'       => ! in_array( $booking->get_status(), array( 'cancelled', 'complete', 'failed', 'in-cart' ), true ),
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
	 * Return monthly availability for a bookable product, formatted to match
	 * CIAB's `/wc-bookings/v2/products/{id}/availability` response so the
	 * reschedule modal's hooks (`useBookingAvailability`,
	 * `fetchMonthAvailability`) work unchanged.
	 *
	 * Wraps WC Bookings' own engine — `WC_Product_Booking::get_blocks_in_range()`
	 * + `get_time_slots()` — and re-projects the slots through the requested
	 * client timezone offset (mirrors `WC_Bookings_Availability_Store_API`).
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_product_availability( WP_REST_Request $request ) {
		$product_id = absint( $request['id'] );
		$product    = function_exists( 'get_wc_product_booking' )
			? get_wc_product_booking( $product_id )
			: null;
		if ( ! $product ) {
			return new WP_Error(
				'wc_bookings_dv_invalid_product',
				__( 'Invalid product ID.', 'woocommerce-bookings' ),
				array( 'status' => 400 )
			);
		}

		$start_date_input = (string) $request['start_date'];
		$end_date_input   = (string) $request['end_date'];
		$timezone_offset  = (int) $request['timezone_offset'];
		$resource_id      = (int) $request['resource_id'];

		$start_date = $timezone_offset
			? strtotime( $start_date_input . ' ' . $timezone_offset . ' hours' )
			: strtotime( $start_date_input );
		$end_date   = $timezone_offset
			? strtotime( $end_date_input . ' ' . $timezone_offset . ' hours' )
			: strtotime( $end_date_input );

		if ( ! $start_date || ! $end_date || $start_date >= $end_date ) {
			return new WP_Error(
				'wc_bookings_dv_invalid_range',
				__( 'Invalid date range.', 'woocommerce-bookings' ),
				array( 'status' => 400 )
			);
		}

		$blocks           = $product->get_blocks_in_range( $start_date, $end_date, null, $resource_id, array() );
		$slots            = $product->get_time_slots( $blocks, $resource_id, $start_date, $end_date );
		$available_blocks = self::adjust_blocks_for_timezone( $slots, $timezone_offset );

		return rest_ensure_response(
			array(
				'product_id'      => $product_id,
				'resource_id'     => $resource_id,
				'start_date'      => $start_date_input,
				'end_date'        => $end_date_input,
				'timezone_offset' => $timezone_offset,
				'availability'    => self::format_availability( $available_blocks ),
			)
		);
	}

	/**
	 * Re-anchor block timestamps in the caller's timezone — only when the
	 * store is configured to "use client timezone". Otherwise return the
	 * blocks unmodified. Mirrors
	 * `WC_Bookings_Availability_Store_API::adjust_blocks_for_timezone()`.
	 *
	 * @param array $blocks          Time-slot blocks keyed by timestamp.
	 * @param int   $timezone_offset Offset in hours (e.g. -5).
	 * @return array
	 */
	private static function adjust_blocks_for_timezone( array $blocks, $timezone_offset = 0 ) {
		$timezone_offset = (int) $timezone_offset;
		if (
			0 === $timezone_offset ||
			! class_exists( 'WC_Bookings_Timezone_Settings' ) ||
			'yes' !== WC_Bookings_Timezone_Settings::get( 'use_client_timezone' )
		) {
			return $blocks;
		}

		$server_timezone = function_exists( 'wc_booking_get_timezone_string' )
			? wc_booking_get_timezone_string()
			: wp_timezone_string();
		$updated         = array();
		foreach ( $blocks as $timestamp => $block ) {
			// phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
			$dt              = new DateTime( date( 'Y-m-d\TH:i:s', $timestamp ), new DateTimeZone( $server_timezone ) );
			$new_ts          = $dt->getTimestamp() + $timezone_offset * HOUR_IN_SECONDS;
			$updated[ $new_ts ] = $block;
		}
		return $updated;
	}

	/**
	 * Group a flat timestamp-keyed slots array into the nested
	 * { "YYYY-MM": { "YYYY-MM-DD": { "HH:mm:ss": count } } } shape the
	 * front-end consumes.
	 *
	 * @param array $blocks Slots keyed by Unix timestamp.
	 * @return array
	 */
	private static function format_availability( array $blocks ) {
		$data = array();
		foreach ( $blocks as $timestamp => $block ) {
			$month = gmdate( 'Y-m', $timestamp );
			$day   = gmdate( 'Y-m-d', $timestamp );
			$time  = gmdate( 'H:i:s', $timestamp );
			if ( ! isset( $data[ $month ] ) ) {
				$data[ $month ] = array();
			}
			if ( ! isset( $data[ $month ][ $day ] ) ) {
				$data[ $month ][ $day ] = array();
			}
			$data[ $month ][ $day ][ $time ] = isset( $block['available'] ) ? (int) $block['available'] : 0;
		}
		return $data;
	}

	/**
	 * Reschedule a booking — set new start/end (and optionally resource).
	 *
	 * Times come in as Unix seconds; we hand them straight to the
	 * WC_Booking setters, which accept timestamps. The save() call goes
	 * through the data store so cached objects invalidate (same pattern
	 * mark_attended / mark_paid use).
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function reschedule_booking( WP_REST_Request $request ) {
		$id = absint( $request['id'] );
		if ( 'wc_booking' !== get_post_type( $id ) ) {
			return new WP_Error(
				'wc_bookings_dv_not_found',
				__( 'Booking not found.', 'woocommerce-bookings' ),
				array( 'status' => 404 )
			);
		}

		$start = (int) $request['start'];
		$end   = (int) $request['end'];
		if ( $start <= 0 || $end <= $start ) {
			return new WP_Error(
				'wc_bookings_dv_invalid_range',
				__( 'Invalid start or end time.', 'woocommerce-bookings' ),
				array( 'status' => 400 )
			);
		}

		$booking = get_wc_booking( $id );
		if ( ! $booking ) {
			return new WP_Error(
				'wc_bookings_dv_not_found',
				__( 'Booking not found.', 'woocommerce-bookings' ),
				array( 'status' => 404 )
			);
		}

		// Mirror CIAB's `isEligible` — reject rescheduling for booking
		// statuses where it would make no sense.
		if ( in_array( $booking->get_status(), array( 'cancelled', 'complete', 'failed', 'in-cart' ), true ) ) {
			return new WP_Error(
				'wc_bookings_dv_not_eligible',
				__( 'This booking cannot be rescheduled.', 'woocommerce-bookings' ),
				array( 'status' => 409 )
			);
		}

		$booking->set_start( $start );
		$booking->set_end( $end );

		$resource_id = isset( $request['resource_id'] ) ? (int) $request['resource_id'] : 0;
		if ( $resource_id > 0 ) {
			$booking->set_resource_id( $resource_id );
		}

		$booking->save();

		$post = get_post( $id );
		return rest_ensure_response( $this->shape_booking_detail( $booking, $post ) );
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
			if ( in_array( $booking->get_status(), array( 'cancelled', 'paid', 'complete', 'refunded' ), true ) ) {
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
	 * Resolve a payment_status filter value to the set of booking IDs that
	 * should be shown. The booking→order link lives in `post_parent` on the
	 * wc_booking post (same field WC_Booking_Data_Store reads); using it
	 * here keeps the filter consistent with what `paymentStateFor` displays.
	 * HPOS-compatible: post_parent holds the order ID regardless of where
	 * the order itself is stored.
	 *
	 * @return int[]
	 */
	private static function booking_ids_for_payment_state( $state ) {
		global $wpdb;

		if ( 'no_order' === $state ) {
			return array_map(
				'intval',
				(array) $wpdb->get_col(
					"SELECT ID FROM {$wpdb->posts}
					WHERE post_type = 'wc_booking'
					AND ( post_parent = 0 OR post_parent IS NULL )"
				)
			);
		}

		$order_ids = array();
		switch ( $state ) {
			case 'paid':
				$regular = wc_get_orders( array(
					'status' => array( 'processing', 'completed' ),
					'limit'  => -1,
					'return' => 'ids',
				) );
				$cancelled_paid = wc_get_orders( array(
					'status'    => array( 'cancelled' ),
					'limit'     => -1,
					'return'    => 'ids',
					'date_paid' => '>0',
				) );
				$order_ids = array_unique( array_merge( (array) $regular, (array) $cancelled_paid ) );
				break;
			case 'unpaid':
				// Everything that isn't paid/refunded/cancelled — including
				// checkout-draft and any extension-registered statuses.
				$all_statuses    = array_map(
					static function ( $s ) { return preg_replace( '/^wc-/', '', $s ); },
					array_keys( wc_get_order_statuses() )
				);
				$unpaid_statuses = array_values( array_diff( $all_statuses, array( 'processing', 'completed', 'refunded', 'cancelled' ) ) );
				$order_ids       = (array) wc_get_orders( array(
					'status' => $unpaid_statuses,
					'limit'  => -1,
					'return' => 'ids',
				) );
				break;
			case 'refunded':
				$order_ids = (array) wc_get_orders( array(
					'status' => array( 'refunded' ),
					'limit'  => -1,
					'return' => 'ids',
				) );
				break;
		}

		if ( empty( $order_ids ) ) {
			return array();
		}

		$order_ids_csv = implode( ',', array_map( 'intval', $order_ids ) );
		return array_map(
			'intval',
			(array) $wpdb->get_col(
				"SELECT ID FROM {$wpdb->posts}
				WHERE post_type = 'wc_booking'
				AND post_parent IN ($order_ids_csv)" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			)
		);
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
		$tab            = (string) $request['tab'];
		$attendance     = (string) $request['attendance'];
		$payment_status = (string) $request['payment_status'];

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

			// Customer name / email match for guest bookings. The user-table
			// lookup above only catches registered customers; everyone who
			// checks out as a guest has their info on the parent order's
			// billing address. `wc_get_orders` with `s` is HPOS-aware and
			// searches billing first/last name + email.
			$order_match_ids = wc_get_orders(
				array(
					'limit'  => -1,
					'return' => 'ids',
					'status' => 'any',
					's'      => $search,
				)
			);
			if ( ! empty( $order_match_ids ) ) {
				$matched_ids = array_merge(
					$matched_ids,
					get_posts(
						array(
							'post_type'       => 'wc_booking',
							'post_status'     => 'any',
							'posts_per_page'  => -1,
							'fields'          => 'ids',
							'post_parent__in' => array_map( 'intval', $order_match_ids ),
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

		// Attendance filter. Mirrors the badge rule in fields.js exactly:
		//   "Attended"   = `_booking_attendance_status` is explicitly 'attended'
		//   "Unattended" = anything else (missing meta OR a value !== 'attended')
		// Past-vs-future no longer matters — every non-cancelled booking
		// shows one of the two badges, so the filter follows suit.
		// Cancelled bookings show "—" (not a badge), so they're excluded
		// from both filter results.
		if ( 'attended' === $attendance || 'unattended' === $attendance ) {
			// 'any' in WP_Query expands to every status where
			// `exclude_from_search` is false. We replicate that set so the
			// attendance filter doesn't accidentally widen visibility, then
			// subtract `cancelled` (those rows show "—", not a badge).
			if ( 'any' === $args['post_status'] ) {
				$any_visible = get_post_stati( array( 'exclude_from_search' => false ), 'names' );
				$args['post_status'] = array_values( array_diff( $any_visible, array( 'cancelled' ) ) );
			} elseif ( is_array( $args['post_status'] ) ) {
				$args['post_status'] = array_values( array_diff( $args['post_status'], array( 'cancelled' ) ) );
			}
		}
		if ( 'attended' === $attendance ) {
			$meta_query[] = array(
				'key'   => '_booking_attendance_status',
				'value' => 'attended',
			);
		} elseif ( 'unattended' === $attendance ) {
			$meta_query[] = array(
				'relation' => 'OR',
				array(
					'key'     => '_booking_attendance_status',
					'compare' => 'NOT EXISTS',
				),
				array(
					'key'     => '_booking_attendance_status',
					'value'   => 'attended',
					'compare' => '!=',
				),
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

		if ( $payment_status ) {
			$matching_ids = self::booking_ids_for_payment_state( $payment_status );
			$args['post__in'] = empty( $matching_ids ) ? array( 0 ) : $matching_ids;
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
			case 'resource':
				$args['meta_key'] = '_booking_resource_id'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				$args['orderby']  = 'meta_value_num';
				$args['order']    = $order;
				break;
			case 'customer':
				// Group bookings by registered customer id. Guests (user_id = 0)
				// land together at the top/bottom of the sort. True alphabetic
				// sort would require a JOIN against wp_users.display_name plus
				// guest names on the parent order — out of scope for the meta
				// query path WP_Query supports.
				$args['meta_key'] = '_booking_customer_id'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
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

		$person_counts_breakdown = array();
		if ( ! empty( $person_counts ) ) {
			foreach ( $person_counts as $person_id => $count ) {
				try {
					$person_type = new WC_Product_Booking_Person_Type( $person_id );
				} catch ( Exception $e ) {
					continue;
				}
				$person_counts_breakdown[] = array(
					'key'   => $person_type->get_name(),
					'value' => (int) $count,
				);
			}
		}

		$attendance    = $booking->get_attendance_status();
		$cost          = (float) $booking->get_cost();
		$end           = (string) get_post_meta( $post->ID, '_booking_end', true );
		$start         = (string) get_post_meta( $post->ID, '_booking_start', true );
		$now           = ( new DateTimeImmutable( 'now', wp_timezone() ) )->format( 'YmdHis' );

		// Unix-seconds projections of the YmdHis meta strings, used by
		// the reschedule modal (it expects raw timestamps so it can
		// build JS Date objects without parsing locale-formatted text).
		$tz            = wp_timezone();
		$start_dt      = $start ? DateTimeImmutable::createFromFormat( 'YmdHis', $start, $tz ) : false;
		$end_dt        = $end ? DateTimeImmutable::createFromFormat( 'YmdHis', $end, $tz ) : false;
		$start_ts      = $start_dt ? $start_dt->getTimestamp() : 0;
		$end_ts        = $end_dt ? $end_dt->getTimestamp() : 0;
		$product_id_v  = $product && is_callable( array( $product, 'get_id' ) ) ? (int) $product->get_id() : 0;
		$resource_id_v = $resource ? (int) $resource->get_id() : 0;

		return array(
			'id'                      => $post->ID,
			'edit_url'                => admin_url( 'post.php?post=' . $post->ID . '&action=edit' ),
			'detail_url'              => admin_url( 'edit.php?post_type=wc_booking&page=' . WC_Bookings_DataViews_Page::PAGE_SLUG . '&booking=' . $post->ID ),
			'total'                   => $cost,
			'total_display'           => html_entity_decode( wp_strip_all_tags( wc_price( $cost ) ), ENT_QUOTES, 'UTF-8' ),
			'is_past'                 => ( '' !== $end && $end < $now ),
			'is_today'                => ( '' !== $start && '' !== $end && $start <= $now && $end >= $now ),
			'status'                  => $booking->get_status(),
			'attendance_status'       => $attendance ? $attendance : null,
			'product'                 => $product_data,
			'num_of_persons'          => $num_persons,
			'person_counts'           => $person_counts_breakdown,
			'customer'                => array(
				// Core WC Bookings appends " (Guest)" to the name when the
				// customer isn't registered. The "Registered" badge in the
				// Customer card carries that signal, so the suffix is
				// redundant noise — strip it on the way out.
				'name'    => isset( $customer->name )
					? trim( (string) preg_replace( '/\s*\(Guest\)\s*$/i', '', (string) $customer->name ) )
					: '',
				'email'   => isset( $customer->email ) ? $customer->email : '',
				'user_id' => isset( $customer->user_id ) ? (int) $customer->user_id : 0,
			),
			'order'                   => $order ? array(
				'id'        => $order->get_id(),
				'number'    => $order->get_order_number(),
				'edit_url'  => $order->get_edit_order_url(),
				'status'    => $order->get_status(),
				'date_paid' => $order->get_date_paid() ? $order->get_date_paid()->date( DATE_ATOM ) : null,
			) : null,
			'start_date'              => $booking->get_start_date(),
			'end_date'                => $booking->get_end_date(),
			// Raw timestamps + ids consumed by the reschedule modal.
			'start'                   => $start_ts,
			'end'                     => $end_ts,
			'product_id'              => $product_id_v,
			'resource_id'             => $resource_id_v,
		);
	}
}
