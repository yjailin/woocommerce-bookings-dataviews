<?php
/**
 * WC_Bookings_DataViews_Page class.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_DataViews_Page' ) ) {
	return;
}

/**
 * Renders the DataViews bookings admin page and enqueues the React bundle.
 */
class WC_Bookings_DataViews_Page {

	const PAGE_SLUG = 'wc-bookings-dataviews';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'maybe_enqueue' ) );
	}

	/**
	 * Render the page.
	 *
	 * Two shells share the same admin slug:
	 *   - List: edit.php?post_type=wc_booking&page=wc-bookings-dataviews
	 *   - Detail: same URL + &booking=<id>
	 */
	public static function render() {
		$booking_id = isset( $_GET['booking'] ) ? absint( wp_unslash( $_GET['booking'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( $booking_id ) {
			self::render_detail( $booking_id );
			return;
		}

		self::render_list();
	}

	/**
	 * Render the list shell (the original render() body).
	 */
	private static function render_list() {
		require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-posts-list-table.php';
		require_once ABSPATH . 'wp-admin/includes/list-table.php';

		// Emulate the edit.php?post_type=wc_booking context so WC Bookings
		// filters (columns, restrict_manage_posts, views) apply.
		// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited
		$GLOBALS['typenow']          = 'wc_booking';
		$GLOBALS['post_type']        = 'wc_booking';
		$GLOBALS['post_type_object'] = get_post_type_object( 'wc_booking' );
		$_REQUEST['post_type']       = 'wc_booking';
		// phpcs:enable WordPress.WP.GlobalVariablesOverride.Prohibited
		if ( ! isset( $_GET['post_type'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$_GET['post_type'] = 'wc_booking'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		$list_table = _get_list_table(
			'WP_Posts_List_Table',
			array( 'screen' => 'edit-wc_booking' )
		);
		$list_table->prepare_items();
		?>
		<div class="wrap">
			<div id="wc-bookings-dv-header"></div>
			<hr class="wp-header-end" />

			<form id="posts-filter" method="get">
				<input type="hidden" name="post_type" value="wc_booking" />
				<input type="hidden" name="page" value="<?php echo esc_attr( self::PAGE_SLUG ); ?>" />

				<?php
				ob_start();
				$list_table->display();
				$html = ob_get_clean();
				$html = preg_replace(
					'#<table class="wp-list-table[^"]*"[^>]*>.*?</table>#s',
					'<div id="wc-bookings-dv-root"></div>',
					$html
				);
				echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Render the booking detail shell. The React app reads the booking ID
	 * from the URL and fetches the rest via REST.
	 *
	 * @param int $booking_id Booking ID to display.
	 */
	private static function render_detail( $booking_id ) {
		?>
		<div class="wrap wc-bookings-dv-detail-wrap">
			<div id="wc-bookings-dv-detail-root" data-booking-id="<?php echo esc_attr( (string) $booking_id ); ?>"></div>
		</div>
		<?php
	}

	/**
	 * Enqueue scripts and styles for the DataViews bookings page.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function maybe_enqueue( $hook ) {
		if ( false === strpos( (string) $hook, self::PAGE_SLUG ) ) {
			return;
		}

		$asset_file = WC_BOOKINGS_DATAVIEWS_PATH . 'build/index.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			wp_die( esc_html__( 'Bookings DataViews build is missing. Run `npm install && npm run build` in the plugin folder.', 'woocommerce-bookings' ) );
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'wc-bookings-dataviews',
			WC_BOOKINGS_DATAVIEWS_URL . '/build/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_enqueue_style(
			'wc-bookings-dataviews',
			WC_BOOKINGS_DATAVIEWS_URL . '/build/style-index.css',
			array( 'wp-components' ),
			$asset['version']
		);

		wp_localize_script(
			'wc-bookings-dataviews',
			'WC_BOOKINGS_DATAVIEWS_DATA',
			array(
				'restUrl'    => esc_url_raw( rest_url( WC_Bookings_DataViews_REST::NAMESPACE . '/dataviews/' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'editUrl'    => admin_url( 'post.php?action=edit&post=' ),
				'newUrl'     => admin_url( 'edit.php?post_type=wc_booking&page=create_booking' ),
				'currentUrl' => admin_url( 'edit.php?post_type=wc_booking' ),
				'listUrl'    => admin_url( 'edit.php?post_type=wc_booking&page=' . self::PAGE_SLUG ),
				'detailUrl'  => admin_url( 'edit.php?post_type=wc_booking&page=' . self::PAGE_SLUG . '&booking=' ),
			)
		);
	}
}
