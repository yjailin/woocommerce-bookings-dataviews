import { createRoot, render, StrictMode } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { Button } from '@wordpress/components';
import { Page } from '@wordpress/admin-ui';
import { SnackbarNotices } from '@wordpress/notices';
import { __ } from '@wordpress/i18n';
import App from './app';
import BookingDetail from './booking-detail';
import './style.scss';

function mount( node, tree ) {
	if ( createRoot ) {
		createRoot( node ).render( tree );
	} else {
		render( tree, node );
	}
}

/**
 * Render the snackbar host once. Mounted into its own body-level container
 * so both list and detail views share a single notice surface (mirrors the
 * `<SnackbarNotices/>` pattern in WooCommerce's experimental products app).
 */
function mountSnackbars() {
	let host = document.getElementById( 'wc-bookings-dv-snackbar' );
	if ( ! host ) {
		host = document.createElement( 'div' );
		host.id = 'wc-bookings-dv-snackbar';
		document.body.appendChild( host );
	}
	mount( host, <SnackbarNotices /> );
}

domReady( () => {
	// Detail page — branched on a separate mount point. Render it first
	// and bail so the list-view header doesn't also try to mount.
	const detail = document.getElementById( 'wc-bookings-dv-detail-root' );
	if ( detail ) {
		const bookingId = Number( detail.dataset.bookingId || 0 );
		mount(
			detail,
			<StrictMode>
				<BookingDetail bookingId={ bookingId } />
			</StrictMode>
		);
		mountSnackbars();
		return;
	}

	const header = document.getElementById( 'wc-bookings-dv-header' );
	if ( header ) {
		mount(
			header,
			<Page
				title={ __( 'Bookings', 'woocommerce-bookings' ) }
				subTitle={ __( 'Manage and keep track of your bookings.', 'woocommerce-bookings' ) }
				headingLevel={ 1 }
				showSidebarToggle={ false }
				actions={
					window.WC_BOOKINGS_DATAVIEWS_DATA?.newUrl ? (
						<Button variant="primary" href={ window.WC_BOOKINGS_DATAVIEWS_DATA.newUrl }>
							{ __( 'Add booking', 'woocommerce-bookings' ) }
						</Button>
					) : null
				}
			/>
		);
	}

	const root = document.getElementById( 'wc-bookings-dv-root' );
	if ( root ) {
		mount(
			root,
			<StrictMode>
				<App />
			</StrictMode>
		);
		mountSnackbars();
	}
} );
