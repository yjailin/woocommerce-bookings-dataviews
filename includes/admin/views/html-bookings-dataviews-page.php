<?php
/**
 * DataViews bookings page shell.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-posts-list-table.php';
require_once ABSPATH . 'wp-admin/includes/list-table.php';

// Emulate the edit.php?post_type=wc_booking context so WC Bookings
// filters (columns, restrict_manage_posts, views) apply correctly.
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
	<div id="wc-bookings-dataviews-header"></div>
	<hr class="wp-header-end" />

	<form id="posts-filter" method="get">
		<input type="hidden" name="post_type" value="wc_booking" />
		<input type="hidden" name="page" value="<?php echo esc_attr( WC_Bookings_DataViews_Page::PAGE_SLUG ); ?>" />

		<?php
		ob_start();
		$list_table->display();
		$html = ob_get_clean();

		// Keep all the WP admin chrome (bulk actions, status tabs, pagination)
		// but replace the actual results table with the DataViews mount point.
		$html = preg_replace(
			'#<table class="wp-list-table[^"]*"[^>]*>.*?</table>#s',
			'<div id="wc-bookings-dataviews-root"></div>',
			$html
		);

		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		?>
	</form>
</div>
