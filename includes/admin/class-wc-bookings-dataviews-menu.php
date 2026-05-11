<?php
/**
 * WC_Bookings_DataViews_Menu class.
 *
 * @package WooCommerce Bookings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'WC_Bookings_DataViews_Menu' ) ) {
	return;
}

/**
 * Registers the DataViews bookings submenu and removes the classic list table entry.
 */
class WC_Bookings_DataViews_Menu {

	/**
	 * Constructor.
	 */
	public function __construct() {
		// Run late so WC Bookings has already registered its submenus.
		add_action( 'admin_menu', array( $this, 'register_page' ), 60 );
		add_action( 'admin_menu', array( $this, 'connect_wc_page' ), 60 );
		add_action( 'admin_menu', array( $this, 'swap_menu' ), 999 );
		add_filter( 'woocommerce_screen_ids', array( $this, 'add_screen_id' ) );
		add_action( 'load-edit.php', array( $this, 'redirect_classic_list' ) );
	}

	/**
	 * Redirect the classic post-list URL to the DataViews page.
	 *
	 * When a user clicks the top-level "Bookings" menu item it lands on
	 * edit.php?post_type=wc_booking. We redirect that to the DataViews page
	 * so both entry points show the same experience.
	 */
	public function redirect_classic_list() {
		$post_type = isset( $_GET['post_type'] ) ? sanitize_key( $_GET['post_type'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page      = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'wc_booking' !== $post_type || '' !== $page ) {
			return;
		}
		wp_safe_redirect( admin_url( 'edit.php?post_type=wc_booking&page=' . WC_Bookings_DataViews_Page::PAGE_SLUG ) );
		exit;
	}

	/**
	 * Directly connect our page to the WooCommerce page controller so the
	 * WC nav bar renders on it. Must run after register_page() so the submenu
	 * entry exists, but we can't rely on the woocommerce_bookings_page_items
	 * filter because WC_Bookings_Menus::register_pages() fires at priority 10
	 * — before we add our page at priority 60.
	 */
	public function connect_wc_page() {
		if ( ! class_exists( '\Automattic\WooCommerce\Admin\PageController' ) ) {
			return;
		}
		$controller = \Automattic\WooCommerce\Admin\PageController::get_instance();
		$controller->connect_page(
			array(
				'id'        => 'wc_booking_page_' . WC_Bookings_DataViews_Page::PAGE_SLUG,
				'screen_id' => 'wc_booking_page_' . WC_Bookings_DataViews_Page::PAGE_SLUG,
				'title'     => __( 'All Bookings', 'woocommerce-bookings' ),
			)
		);
	}

	/**
	 * Register the screen ID with WooCommerce.
	 *
	 * @param array $ids Existing screen IDs.
	 * @return array
	 */
	public function add_screen_id( $ids ) {
		$ids[] = 'wc_booking_page_' . WC_Bookings_DataViews_Page::PAGE_SLUG;
		return $ids;
	}

	/**
	 * Register the DataViews bookings page as a submenu item.
	 */
	public function register_page() {
		$hook = add_submenu_page(
			'edit.php?post_type=wc_booking',
			__( 'All Bookings', 'woocommerce-bookings' ),
			__( 'All Bookings', 'woocommerce-bookings' ),
			'edit_wc_bookings', // phpcs:ignore WordPress.WP.Capabilities.Unknown
			WC_Bookings_DataViews_Page::PAGE_SLUG,
			array( 'WC_Bookings_DataViews_Page', 'render' )
		);
		if ( $hook ) {
			add_action( "load-{$hook}", array( $this, 'add_screen_options' ) );
		}
	}

	/**
	 * Add screen options for the DataViews bookings page.
	 */
	public function add_screen_options() {
		add_screen_option(
			'per_page',
			array(
				'label'   => __( 'Bookings', 'woocommerce-bookings' ),
				'default' => 20,
				'option'  => 'wc_bookings_dv_per_page',
			)
		);
	}

	/**
	 * Remove the classic "All Bookings" list table entry and move our
	 * DataViews page to the top of the submenu in its place.
	 */
	public function swap_menu() {
		global $submenu; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$parent = 'edit.php?post_type=wc_booking';
		if ( empty( $submenu[ $parent ] ) ) {
			return;
		}

		// Remove the classic list table entry (slug = parent key).
		remove_submenu_page( $parent, $parent );

		// Move the DataViews entry to the top.
		$items    = array_values( $submenu[ $parent ] );
		$dv_index = null;
		foreach ( $items as $i => $item ) {
			if ( isset( $item[2] ) && WC_Bookings_DataViews_Page::PAGE_SLUG === $item[2] ) {
				$dv_index = $i;
				break;
			}
		}

		if ( null === $dv_index ) {
			return;
		}

		$dv_item = $items[ $dv_index ];
		array_splice( $items, $dv_index, 1 );
		array_unshift( $items, $dv_item );

		$submenu[ $parent ] = $items; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
	}
}
