<?php
/**
 * WC_Bookings_Modal_Flow class.
 *
 * Wraps the customer-facing booking form in a modal triggered by a
 * "Book now" button on bookable product pages. Reuses the existing
 * WC_Booking_Form output and AJAX endpoints unchanged.
 *
 * @package WooCommerce Bookings DataViews
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_Modal_Flow' ) ) {
	return;
}

/**
 * Replaces the inline booking form with a "Book now" button that opens a modal.
 */
class WC_Bookings_Modal_Flow {

	const ASSET_HANDLE = 'wc-bookings-modal-booking';

	const REDIRECT_FIELD = 'wc_bookings_modal_redirect_checkout';

	/**
	 * The booking form prepared for the current product page.
	 *
	 * Held between the action swap (when we render the trigger) and
	 * `wp_footer` (when we render the modal contents).
	 *
	 * @var WC_Booking_Form|null
	 */
	private $booking_form = null;

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'wp', array( $this, 'maybe_swap_inline_form' ), 20 );
		add_filter( 'woocommerce_add_to_cart_redirect', array( $this, 'maybe_redirect_to_checkout' ), 10, 2 );
	}

	/**
	 * On a bookable single-product page, remove the inline form action
	 * and install our trigger renderer in its place.
	 */
	public function maybe_swap_inline_form() {
		if ( ! $this->is_booking_product_page() ) {
			return;
		}

		if ( ! class_exists( 'WC_Booking_Cart_Manager' ) ) {
			return;
		}

		$cart_manager = WC_Booking_Cart_Manager::get_instance();
		remove_action( 'woocommerce_booking_add_to_cart', array( $cart_manager, 'add_to_cart' ), 30 );

		add_action( 'woocommerce_booking_add_to_cart', array( $this, 'render_modal_trigger' ), 30 );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'wp_footer', array( $this, 'render_modal_markup' ) );
	}

	/**
	 * True when viewing a single bookable product on the frontend.
	 *
	 * @return bool
	 */
	private function is_booking_product_page(): bool {
		if ( is_admin() || ! function_exists( 'is_product' ) || ! is_product() ) {
			return false;
		}

		$product = wc_get_product( get_the_ID() );

		if ( ! $product ) {
			return false;
		}

		return 'booking' === $product->get_type() && function_exists( 'is_wc_booking_product' ) && is_wc_booking_product( $product );
	}

	/**
	 * Renders the "Book now" trigger button in place of the inline form.
	 *
	 * The actual form lives inside the modal markup rendered in wp_footer,
	 * so themes that wrap product summaries in transformed or
	 * overflow-hidden containers can't clip the overlay.
	 */
	public function render_modal_trigger() {
		global $product;

		if ( ! $product || ! $product->is_purchasable() ) {
			return;
		}

		$this->booking_form = new WC_Booking_Form( $product );

		include WC_BOOKINGS_DATAVIEWS_PATH . 'includes/frontend/views/html-booking-modal-trigger.php';
	}

	/**
	 * Renders the modal markup (dialog + form) at the bottom of the page.
	 */
	public function render_modal_markup() {
		if ( null === $this->booking_form ) {
			return;
		}

		$booking_form = $this->booking_form;
		$product      = $booking_form->product;
		$nonce        = wp_create_nonce( 'find-booked-day-blocks' );

		include WC_BOOKINGS_DATAVIEWS_PATH . 'includes/frontend/views/html-booking-modal-dialog.php';
	}

	/**
	 * Enqueues the modal styles and behaviour script.
	 *
	 * Depends on `wc-bookings-booking-form` so the core form bindings
	 * have already attached by the time our modal initialises.
	 */
	public function enqueue_assets() {
		$asset_file = WC_BOOKINGS_DATAVIEWS_PATH . 'build/modal-booking.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			self::ASSET_HANDLE,
			WC_BOOKINGS_DATAVIEWS_URL . '/build/modal-booking.js',
			array_merge( $asset['dependencies'], array( 'wc-bookings-booking-form' ) ),
			$asset['version'],
			true
		);

		wp_enqueue_style(
			self::ASSET_HANDLE,
			WC_BOOKINGS_DATAVIEWS_URL . '/build/modal-booking.css',
			array(),
			$asset['version']
		);
	}

	/**
	 * Redirects to checkout after a successful add-to-cart when the
	 * customer hit the modal's "Proceed to Checkout" button.
	 *
	 * @param string     $url     Default redirect URL.
	 * @param WC_Product $product Product being added (unused).
	 * @return string
	 */
	public function maybe_redirect_to_checkout( $url, $product ) {
		unset( $product );

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- WC core handles nonces for add-to-cart.
		if ( empty( $_POST[ self::REDIRECT_FIELD ] ) ) {
			return $url;
		}

		// If validation surfaced errors we let WC re-render the form
		// with notices instead of bouncing the customer to checkout.
		if ( function_exists( 'wc_notice_count' ) && wc_notice_count( 'error' ) > 0 ) {
			return $url;
		}

		return wc_get_checkout_url();
	}
}
