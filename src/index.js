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

/**
 * DataViews renders every `isPrimary: true` action twice — once as the
 * inline hover icon next to the kebab (the desired "quick access" UX)
 * and once as the first entry inside the kebab dropdown (the
 * undesired duplication). We register "View booking" as primary so the
 * eye icon appears inline; this observer hides the duplicate inside
 * the kebab popover.
 *
 * The kebab and the column-header popover both use `@wordpress/components`'s
 * private Menu, which portals to <body> with an emotion-suffixed
 * `Menu-Menu` class — so a generic `[class*="Menu-Menu"] [role="menuitem"]:first-child`
 * selector over-hides into the column popover (where it would silently
 * eat "Sort ascending" / "Add filter" / etc., depending on field config).
 *
 * Ariakit links each popover to its trigger via `aria-labelledby`; the
 * row-actions trigger has class `dataviews-all-actions-button` (set by
 * DataViews in `dataviews-item-actions`). When a portaled menu appears,
 * follow the link and mark the popover only when the trigger matches.
 * The scoped CSS rule (see style.scss) then hides the duplicate first
 * item inside that marker class — and leaves every other menu alone.
 */
function startRowActionsMenuMarker() {
	const MARKER = 'wc-bookings-dv-row-actions-menu';

	const markIfRowActionsMenu = ( menu ) => {
		if ( menu.classList.contains( MARKER ) ) return;
		const triggerId = menu.getAttribute( 'aria-labelledby' );
		if ( ! triggerId ) return;
		const trigger = document.getElementById( triggerId );
		if ( trigger && trigger.classList.contains( 'dataviews-all-actions-button' ) ) {
			menu.classList.add( MARKER );
		}
	};

	const scanRoot = ( root ) => {
		if ( root.nodeType !== 1 ) return;
		// Some Menus are mounted once and reused; others spawn on open.
		// Match both the added node itself and any descendants.
		if ( root.matches && root.matches( '[class*="Menu-Menu"]' ) ) {
			markIfRowActionsMenu( root );
		}
		if ( root.querySelectorAll ) {
			root.querySelectorAll( '[class*="Menu-Menu"]' ).forEach(
				markIfRowActionsMenu
			);
		}
	};

	const observer = new MutationObserver( ( mutations ) => {
		for ( const mutation of mutations ) {
			mutation.addedNodes.forEach( scanRoot );
		}
	} );
	observer.observe( document.body, { childList: true, subtree: true } );

	// Catch any menus that were already mounted before the observer started.
	scanRoot( document.body );
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
		startRowActionsMenuMarker();
	}
} );
