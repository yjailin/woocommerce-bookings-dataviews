<?php
/**
 * "Book now" trigger that opens the booking modal.
 *
 * Rendered in place of the inline booking form.
 *
 * @package WooCommerce Bookings DataViews
 *
 * @var WC_Product_Booking $product Current bookable product (from global).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $product;
?>
<div class="wc-bookings-modal-trigger-wrapper">
	<button
		type="button"
		class="wc-bookings-modal-trigger single_add_to_cart_button button alt wp-element-button"
		aria-haspopup="dialog"
		aria-controls="wc-bookings-modal"
	>
		<?php esc_html_e( 'Book now', 'woocommerce-bookings' ); ?>
	</button>
</div>
