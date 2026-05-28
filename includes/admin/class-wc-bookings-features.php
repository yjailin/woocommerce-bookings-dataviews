<?php
/**
 * WC_Bookings_Features class.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_Features' ) ) {
	return;
}

/**
 * Manages opt-in feature flags for WooCommerce Bookings.
 *
 * Each flag is stored as a WordPress option and exposed as a toggle
 * on the Bookings > Settings > Features tab.
 */
class WC_Bookings_Features {

	const FEATURE_DATAVIEWS     = 'dataviews';
	const FEATURE_MODAL_BOOKING = 'modal_booking';
	const OPTION_PREFIX         = 'woocommerce_bookings_feature_';

	/**
	 * All registered feature identifiers.
	 *
	 * @return string[]
	 */
	public static function all(): array {
		return array(
			self::FEATURE_DATAVIEWS,
			self::FEATURE_MODAL_BOOKING,
		);
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_filter( 'woocommerce_bookings_settings_page', array( $this, 'add_features_tab' ) );
		add_action( 'admin_post_wc_bookings_save_features', array( $this, 'save_features' ) );
	}

	/**
	 * Returns true when the given feature flag is enabled.
	 *
	 * @param string $feature Feature identifier, e.g. self::FEATURE_DATAVIEWS.
	 * @return bool
	 */
	public static function is_enabled( string $feature ): bool {
		return 'yes' === get_option( self::OPTION_PREFIX . $feature, 'no' );
	}

	/**
	 * Appends a "Features" tab to the Bookings settings page.
	 *
	 * @param array $tabs_metadata Existing tabs.
	 * @return array
	 */
	public function add_features_tab( array $tabs_metadata ): array {
		$tabs_metadata['features'] = array(
			'name'          => __( 'Features', 'woocommerce-bookings' ),
			'href'          => admin_url( 'edit.php?post_type=wc_booking&page=wc_bookings_settings&tab=features' ),
			'capability'    => 'manage_bookings_settings',
			'generate_html' => array( $this, 'render_features_tab' ),
		);
		return $tabs_metadata;
	}

	/**
	 * Renders the Features settings form.
	 */
	public function render_features_tab() {
		include WC_BOOKINGS_DATAVIEWS_PATH . 'includes/admin/views/html-bookings-features-settings.php';
	}

	/**
	 * Handles POST submission from the Features settings form.
	 */
	public function save_features() {
		check_admin_referer( 'wc_bookings_save_features' );

		if ( ! current_user_can( 'manage_bookings_settings' ) ) { // phpcs:ignore WordPress.WP.Capabilities.Unknown
			wp_die( esc_html__( 'You do not have permission to manage settings.', 'woocommerce-bookings' ) );
		}

		foreach ( self::all() as $feature ) {
			$option_key = self::OPTION_PREFIX . $feature;
			$enabled    = isset( $_POST[ $option_key ] ) ? 'yes' : 'no';
			update_option( $option_key, $enabled );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=wc_booking&page=wc_bookings_settings&tab=features&saved=1' ) );
		exit;
	}
}
