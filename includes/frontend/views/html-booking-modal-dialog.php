<?php
/**
 * Booking modal dialog rendered in wp_footer.
 *
 * Mirrors templates/single-product/add-to-cart/booking.php from
 * woocommerce-bookings core, wrapped in a <dialog>. Reusing the same
 * .wc-bookings-booking-form / .wc-bookings-booking-cost /
 * .wc-bookings-booking-form-button selectors means the existing
 * frontend JS continues to drive price preview, validation, and the
 * submit button's disabled state with no changes to core.
 *
 * @package WooCommerce Bookings DataViews
 *
 * @var WC_Booking_Form    $booking_form Prepared booking form.
 * @var WC_Product_Booking $product      Bookable product.
 * @var string             $nonce        Nonce for find-booked-day-blocks.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$product_id = is_callable( array( $product, 'get_id' ) ) ? $product->get_id() : $product->id;
?>
<dialog
	id="wc-bookings-modal"
	class="wc-bookings-modal"
	aria-labelledby="wc-bookings-modal-title"
	aria-modal="true"
	hidden
>
	<div class="wc-bookings-modal__panel" role="document">
		<header class="wc-bookings-modal__header">
			<h2 id="wc-bookings-modal-title" class="wc-bookings-modal__title">
				<?php
				printf(
					/* translators: %s: product name */
					esc_html__( 'Book %s', 'woocommerce-bookings' ),
					esc_html( $product->get_name() )
				);
				?>
			</h2>
			<button
				type="button"
				class="wc-bookings-modal__close wc-block-components-button wp-element-button wc-block-components-drawer__close contained"
				aria-label="<?php esc_attr_e( 'Close', 'woocommerce-bookings' ); ?>"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
					<path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path>
				</svg>
			</button>
		</header>

		<?php do_action( 'woocommerce_before_add_to_cart_form' ); ?>

		<form class="cart wc-bookings-modal__form" method="post" enctype="multipart/form-data" data-nonce="<?php echo esc_attr( $nonce ); ?>">

			<div class="wc-bookings-modal__body">
				<noscript><?php esc_html_e( 'Your browser must support JavaScript in order to make a booking.', 'woocommerce-bookings' ); ?></noscript>

				<div id="wc-bookings-booking-form" class="wc-bookings-booking-form" style="display:none">

					<?php do_action( 'woocommerce_before_booking_form' ); ?>

					<?php $booking_form->output(); ?>

					<div class="wc-bookings-booking-cost price" style="display:none" data-raw-price=""></div>

				</div>
			</div>

			<footer class="wc-bookings-modal__footer">
				<?php do_action( 'woocommerce_before_add_to_cart_button' ); ?>

				<input type="hidden" name="add-to-cart" value="<?php echo esc_attr( $product_id ); ?>" class="wc-booking-product-id" />
				<input type="hidden" name="<?php echo esc_attr( WC_Bookings_Modal_Flow::REDIRECT_FIELD ); ?>" value="" class="wc-bookings-modal__redirect-flag" />
				<input type="hidden" id="min_date" name="min_date" value="0" />
				<input type="hidden" id="max_date" name="max_date" value="0" />
				<input type="hidden" id="timezone_offset" name="timezone_offset" value="0" />

				<button
					type="button"
					class="wc-bookings-modal__checkout button alt disabled wp-element-button"
					disabled
				>
					<?php esc_html_e( 'Proceed to Checkout', 'woocommerce-bookings' ); ?>
				</button>

				<button
					type="submit"
					class="wc-bookings-booking-form-button single_add_to_cart_button button alt disabled wp-element-button"
					style="display:none"
				>
					<?php esc_html_e( 'Add to cart', 'woocommerce-bookings' ); ?>
				</button>

				<?php do_action( 'woocommerce_after_add_to_cart_button' ); ?>
			</footer>
		</form>

		<?php do_action( 'woocommerce_after_add_to_cart_form' ); ?>
	</div>
</dialog>
