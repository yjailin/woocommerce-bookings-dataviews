<?php
/**
 * Features settings tab view.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$dataviews_enabled = WC_Bookings_Features::is_enabled( WC_Bookings_Features::FEATURE_DATAVIEWS );
$saved             = isset( $_GET['saved'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
?>

<?php if ( $saved ) : ?>
	<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Settings saved.', 'woocommerce-bookings' ); ?></p></div>
<?php endif; ?>

<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
	<?php wp_nonce_field( 'wc_bookings_save_features' ); ?>
	<input type="hidden" name="action" value="wc_bookings_save_features" />

	<table class="form-table">
		<tbody>
			<tr>
				<th scope="row">
					<?php esc_html_e( 'All Bookings (DataViews)', 'woocommerce-bookings' ); ?>
				</th>
				<td>
					<label for="woocommerce_bookings_feature_dataviews">
						<input
							type="checkbox"
							id="woocommerce_bookings_feature_dataviews"
							name="woocommerce_bookings_feature_dataviews"
							value="yes"
							<?php checked( $dataviews_enabled ); ?>
						/>
						<?php esc_html_e( 'Replaces the classic bookings list with a DataViews-powered version. Experimental.', 'woocommerce-bookings' ); ?>
					</label>
				</td>
			</tr>
		</tbody>
	</table>

	<?php submit_button( __( 'Save changes', 'woocommerce-bookings' ) ); ?>
</form>
