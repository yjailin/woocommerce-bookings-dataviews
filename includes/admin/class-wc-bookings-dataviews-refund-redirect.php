<?php
/**
 * Auto-open WooCommerce's existing refund UI on the order edit screen
 * when a Refund action from this plugin redirects there.
 *
 * The Refund action on the bookings list / detail page navigates to
 * the booking's order edit URL with `#wc-bookings-dv-refund` appended.
 * This class hooks `admin_footer` on order edit screens (both the
 * classic post.php-based screen and the HPOS custom screen), checks for
 * that hash client-side, and clicks WC's native "Refund" button —
 * surfacing the same refund flow merchants already know rather than
 * duplicating it in a custom modal.
 *
 * @package WooCommerce Bookings DataViews
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the inline auto-open script.
 */
class WC_Bookings_DataViews_Refund_Redirect {

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_footer', array( $this, 'maybe_print_script' ) );
	}

	/**
	 * Print the auto-open script when the current admin screen is an
	 * order edit page (classic CPT or HPOS).
	 */
	public function maybe_print_script() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen ) {
			return;
		}

		// `shop_order` is the legacy post-type edit screen; the HPOS
		// custom screen registers as `woocommerce_page_wc-orders`. We
		// target both so the same hash works regardless of storage.
		$allowed = array( 'shop_order', 'woocommerce_page_wc-orders' );
		if ( ! in_array( $screen->id, $allowed, true ) ) {
			return;
		}

		// Anchor: `#wc-bookings-dv-refund`. On load, click WC's native
		// `.refund-items` button (the one that toggles the inline
		// refund form) and scroll the form into view. Wrapped in a
		// short setTimeout so any jQuery handlers WC binds during
		// $(document).ready have time to register before we trigger.
		?>
		<script>
		( function () {
			if ( window.location.hash !== '#wc-bookings-dv-refund' ) {
				return;
			}
			var open = function () {
				var btn = document.querySelector( 'button.refund-items' );
				if ( ! btn ) {
					return;
				}
				btn.click();
				if ( typeof btn.scrollIntoView === 'function' ) {
					btn.scrollIntoView( { behavior: 'smooth', block: 'center' } );
				}
			};
			if ( document.readyState === 'complete' ) {
				window.setTimeout( open, 50 );
			} else {
				window.addEventListener( 'load', function () {
					window.setTimeout( open, 50 );
				} );
			}
		} )();
		</script>
		<?php
	}
}
