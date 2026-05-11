import { createRoot, render, StrictMode } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { Button } from '@wordpress/components';
import { Page } from '@wordpress/admin-ui';
import { __ } from '@wordpress/i18n';
import App from './app';
import './style.scss';

function mount( node, tree ) {
	if ( createRoot ) {
		createRoot( node ).render( tree );
	} else {
		render( tree, node );
	}
}

domReady( () => {
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
	}
} );
