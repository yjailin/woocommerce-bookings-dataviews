import { useCallback, useEffect, useMemo, useRef, useState, createPortal } from '@wordpress/element';
import { DataViews } from '@wordpress/dataviews';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __ } from '@wordpress/i18n';
import { Tabs } from '@wordpress/ui';
import { seen } from '@wordpress/icons';
import { dispatch, select, useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { store as preferencesStore } from '@wordpress/preferences';
import { create as createPersistenceLayer } from '@wordpress/preferences-persistence';
import { buildFields } from './fields';
import { BookingEmptyState } from './empty-state';
import { buildRescheduleAction } from './reschedule-booking';

if ( window.WC_BOOKINGS_DATAVIEWS_DATA?.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( window.WC_BOOKINGS_DATAVIEWS_DATA.nonce ) );
}

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl;

const PREFS_SCOPE = 'wc-bookings-dataviews';
const VIEW_PREF = 'all-bookings-view';
const TAB_PREF = 'all-bookings-tab';

const TABS = [
	{ id: 'today', label: 'Today' },
	{ id: 'upcoming', label: 'Upcoming' },
	{ id: 'past', label: 'Past' },
	{ id: 'canceled', label: 'Canceled' },
	{ id: 'all', label: 'All' },
];

const TAB_DEFAULT_SORT = {
	today:    { field: 'start_date', direction: 'asc' },
	upcoming: { field: 'start_date', direction: 'asc' },
	past:     { field: 'start_date', direction: 'desc' },
	canceled: { field: 'start_date', direction: 'desc' },
	all:      { field: 'start_date', direction: 'desc' },
};

// Canonical column order, identity → who → when → state/financial → what.
// Must stay in sync with the order of entries in `buildFields()` in fields.js.
// `id` is the title field (rendered separately via renderItemLink) and is
// not in this list.
const CANONICAL_FIELD_ORDER = [
	'state',
	'resource',
	'customer',
	'num_of_persons',
	'start_date',
	'end_date',
	'payment_status',
	'order',
	'total',
	'product',
];

const DEFAULTS = {
	type: 'table',
	perPage: 20,
	page: 1,
	search: '',
	filters: [],
	sort: { field: 'start_date', direction: 'asc' },
	// Default visible columns. `end_date` and `order` are hidden by default
	// but kept adjacent to their pair (start_date / payment_status) in
	// `CANONICAL_FIELD_ORDER` so they land in the right place when enabled.
	fields: [
		'state',
		'resource',
		'customer',
		'num_of_persons',
		'start_date',
		'payment_status',
		'total',
		'product',
	],
	titleField: 'id',
	layout: {
		styles: {
			id: { width: '90px' },
			total: { width: '80px' },
			num_of_persons: { width: '70px' },
			product: { width: '180px' },
			resource: { width: '140px' },
		},
	},
};

// When DataViews toggles a hidden column on, it appends the new id to the
// end of `view.fields`. Re-insert any newly-added field at its canonical
// position so End Date lands next to Date, Order next to Payment, etc.
// User-initiated drag-reorders are preserved: when the field set is
// unchanged (no additions), we leave the array as-is.
function reconcileFieldsOrder( previousFields, nextFields ) {
	if ( ! Array.isArray( previousFields ) || ! Array.isArray( nextFields ) ) {
		return nextFields;
	}
	const prev = new Set( previousFields );
	const added = nextFields.filter( ( f ) => ! prev.has( f ) );
	if ( added.length === 0 ) {
		return nextFields;
	}
	const preserved = nextFields.filter( ( f ) => prev.has( f ) );
	const result = [ ...preserved ];
	for ( const newField of added ) {
		const canonicalPos = CANONICAL_FIELD_ORDER.indexOf( newField );
		if ( canonicalPos === -1 ) {
			result.push( newField );
			continue;
		}
		let insertAt = result.length;
		for ( let i = 0; i < result.length; i++ ) {
			const existingPos = CANONICAL_FIELD_ORDER.indexOf( result[ i ] );
			if ( existingPos > canonicalPos ) {
				insertAt = i;
				break;
			}
		}
		result.splice( insertAt, 0, newField );
	}
	return result;
}

// setDefaults is sync (first useSelect read returns DEFAULTS); setPersistenceLayer
// is async — App awaits the promise before fetching, so we fetch with the persisted
// view in one shot rather than fetching with defaults then refetching post-hydration.
dispatch( preferencesStore ).setDefaults( PREFS_SCOPE, {
	[ VIEW_PREF ]: DEFAULTS,
	[ TAB_PREF ]: 'upcoming',
} );

// One-shot migration: the experimental Status+Attendance merge replaced the
// `booking_status` and `attendance_status` field IDs with a single `state`.
// Users who interacted with the list before the merge have those stale IDs
// persisted, and DataViews silently drops unknown fields — leaving the new
// State column hidden (and its filter UI orphaned). Translate the ids here
// so the column reappears on the next render without a manual reset.
function migrateView( view ) {
	if ( ! view || ! Array.isArray( view.fields ) ) {
		return view;
	}
	const STALE = [ 'booking_status', 'attendance_status' ];
	if ( ! view.fields.some( ( f ) => STALE.includes( f ) ) ) {
		return view;
	}
	const seen = new Set();
	const migrated = [];
	for ( const f of view.fields ) {
		const next = STALE.includes( f ) ? 'state' : f;
		if ( seen.has( next ) ) continue;
		seen.add( next );
		migrated.push( next );
	}
	return { ...view, fields: migrated };
}

const persistenceReady = dispatch( preferencesStore )
	.setPersistenceLayer( createPersistenceLayer() )
	.then( () => {
		const persisted = select( preferencesStore ).get( PREFS_SCOPE, VIEW_PREF );
		const migrated = migrateView( persisted );
		if ( migrated !== persisted ) {
			dispatch( preferencesStore ).set( PREFS_SCOPE, VIEW_PREF, migrated );
		}
	} );

function firstFilterValue( filters, field ) {
	const f = ( filters || [] ).find( ( x ) => x.field === field );
	if ( ! f || f.value == null ) return null;
	return Array.isArray( f.value ) ? f.value[ 0 ] : f.value;
}

function buildParams( view, tab ) {
	const params = {
		page: view.page || 1,
		per_page: view.perPage || 20,
	};
	if ( view.search ) params.search = view.search;
	if ( view.sort?.field ) {
		const map = {
			id: 'booking_id',
			product: 'booked_product',
			resource: 'resource',
			customer: 'customer',
			start_date: 'start_date',
			end_date: 'end_date',
			total: 'total',
		};
		params.orderby = map[ view.sort.field ] || 'booking_id';
		params.order = view.sort.direction || 'desc';
	}
	const paymentStatus = firstFilterValue( view.filters, 'payment_status' );
	if ( paymentStatus ) params.payment_status = paymentStatus;
	const state = firstFilterValue( view.filters, 'state' );
	if ( state ) params.state = state;
	const product = firstFilterValue( view.filters, 'product' );
	if ( product ) params.product = product;
	const resource = firstFilterValue( view.filters, 'resource' );
	if ( resource ) params.resource = resource;
	const startRange = firstFilterValue( view.filters, 'start_date' );
	if ( startRange ) params.start_range = startRange;
	const endRange = firstFilterValue( view.filters, 'end_date' );
	if ( endRange ) params.end_range = endRange;
	if ( tab ) params.tab = tab;
	return params;
}

export default function App() {
	const [ hydrated, setHydrated ] = useState( false );

	useEffect( () => {
		let cancelled = false;
		persistenceReady.then( () => {
			if ( ! cancelled ) setHydrated( true );
		} );
		return () => {
			cancelled = true;
		};
	}, [] );

	const view = useSelect(
		( s ) => s( preferencesStore ).get( PREFS_SCOPE, VIEW_PREF ),
		[]
	);
	const tab = useSelect(
		( s ) => s( preferencesStore ).get( PREFS_SCOPE, TAB_PREF ),
		[]
	);
	const { set: setPreference } = useDispatch( preferencesStore );
	const { createInfoNotice } = useDispatch( noticesStore );

	const setView = useCallback(
		( nextOrUpdater ) => {
			const current =
				select( preferencesStore ).get( PREFS_SCOPE, VIEW_PREF ) ||
				DEFAULTS;
			const next =
				typeof nextOrUpdater === 'function'
					? nextOrUpdater( current )
					: nextOrUpdater;
			const reconciled = {
				...next,
				fields: reconcileFieldsOrder( current.fields, next.fields ),
			};
			setPreference( PREFS_SCOPE, VIEW_PREF, reconciled );
		},
		[ setPreference ]
	);
	const setTab = useCallback(
		( value ) => setPreference( PREFS_SCOPE, TAB_PREF, value ),
		[ setPreference ]
	);

	const [ data, setData ] = useState( [] );
	const [ totals, setTotals ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ options, setOptions ] = useState( { products: [], resources: [] } );
	const [ toolbarEl, setToolbarEl ] = useState( null );
	const [ refreshToken, setRefreshToken ] = useState( 0 );
	const rootRef = useRef( null );

	// Wait for DataViews to render its toolbar, then portal the tabs
	// into it so they share the same row as search / filter / view config.
	useEffect( () => {
		if ( ! rootRef.current ) return;
		let disposed = false;
		const observer = new MutationObserver( () => {
			const el = rootRef.current?.querySelector( '.dataviews__view-actions' );
			if ( el && ! disposed ) {
				setToolbarEl( el );
				observer.disconnect();
			}
		} );
		observer.observe( rootRef.current, { childList: true, subtree: true } );
		const immediate = rootRef.current?.querySelector( '.dataviews__view-actions' );
		if ( immediate ) {
			setToolbarEl( immediate );
			observer.disconnect();
		}
		return () => {
			disposed = true;
			observer.disconnect();
		};
	}, [] );

	// Load filter options once.
	useEffect( () => {
		apiFetch( { path: REST_BASE + 'filter-options' } )
			.then( ( res ) =>
				setOptions( res || { products: [], resources: [] } )
			)
			.catch( () => {} );
	}, [] );

	useEffect( () => {
		if ( ! hydrated ) return;
		let cancelled = false;
		setIsLoading( true );
		apiFetch( {
			path: addQueryArgs( REST_BASE + 'bookings', buildParams( view, tab ) ),
		} )
			.then( ( res ) => {
				if ( cancelled ) return;
				setData( res.items || [] );
				setTotals( {
					totalItems: res.total_items || 0,
					totalPages: res.total_pages || 0,
				} );
				setIsLoading( false );
			} )
			.catch( () => {
				if ( ! cancelled ) setIsLoading( false );
			} );
		return () => {
			cancelled = true;
		};
	}, [ hydrated, tab, view.page, view.perPage, view.search, view.sort?.field, view.sort?.direction, JSON.stringify( view.filters ), refreshToken ] );

	const fields = useMemo( () => buildFields( options ), [ options ] );

	// Canonical action order — enforced across every surface where
	// actions appear (this list view kebab, the bulk actions bar, the
	// detail-page header kebab, and the detail-page inline button
	// rows). Each surface independently filters by eligibility, but
	// the relative ordering is identical. New actions slot into this
	// sequence so the user can build muscle memory.
	//
	// Confirm + Refuse lead the list because they're the most
	// time-sensitive: a pending booking is held against availability
	// until the merchant decides, so resolving that decision quickly
	// is the merchant's most important workflow.
	//
	//   1. Confirm
	//   2. Refuse
	//   3. Mark as attended
	//   4. Mark as unattended
	//   5. Mark as paid
	//   6. Reschedule
	//   7. View booking
	//   8. View order
	//   9. Refund
	//  10. Cancel
	const actions = useMemo(
		() => [
			{
				id: 'confirm',
				label: __( 'Confirm', 'woocommerce-bookings' ),
				supportsBulk: true,
				isEligible: ( item ) => item?.status === 'pending-confirmation',
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/confirm',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
			{
				id: 'refuse',
				label: __( 'Refuse', 'woocommerce-bookings' ),
				isDestructive: true,
				supportsBulk: true,
				isEligible: ( item ) => item?.status === 'pending-confirmation',
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/cancel',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
			{
				id: 'mark-attended',
				label: __( 'Mark as attended', 'woocommerce-bookings' ),
				supportsBulk: true,
				// Attendance is a post-start concept under our strict
				// lifecycle rule — the State column never shows
				// Attended/Unattended on future bookings, so the action
				// must mirror that gate. Pre-marking writes invisible data
				// and only confuses the merchant.
				isEligible: ( item ) =>
					item?.status !== 'cancelled' &&
					item?.attendance_status !== 'attended' &&
					Number( item?.start ) > 0 &&
					Number( item.start ) <= Date.now() / 1000,
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/mark-attended',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
			{
				id: 'mark-unattended',
				label: __( 'Mark as unattended', 'woocommerce-bookings' ),
				supportsBulk: true,
				// Past rows with no attendance recorded render as em-dash and
				// can be resolved in either direction, so Mark as unattended
				// is eligible whenever the current value isn't already
				// 'unattended' (matches the inverse of Mark as attended).
				isEligible: ( item ) =>
					item?.status !== 'cancelled' &&
					item?.attendance_status !== 'unattended' &&
					Number( item?.start ) > 0 &&
					Number( item.start ) <= Date.now() / 1000,
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/mark-unattended',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
			{
				id: 'mark-paid',
				label: __( 'Mark as paid', 'woocommerce-bookings' ),
				supportsBulk: true,
				// CIAB: shown for any non-paid, non-cancelled booking. `complete`
				// can still need a missing payment recorded (booking ran its
				// course but the order was never paid).
				isEligible: ( item ) => {
					const s = item?.status;
					return s !== 'paid' && s !== 'cancelled' && s !== 'refunded';
				},
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/mark-paid',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} )
						.then( () => {
							setRefreshToken( ( n ) => n + 1 );
							createInfoNotice(
								__( 'Booking marked as paid.', 'woocommerce-bookings' ),
								{ type: 'snackbar' }
							);
						} )
						.catch( ( err ) => {
							createInfoNotice(
								( err && err.message ) ||
									__( 'Mark as paid failed.', 'woocommerce-bookings' ),
								{ type: 'snackbar' }
							);
						} );
				},
			},
			buildRescheduleAction( {
				onSuccess: () => setRefreshToken( ( n ) => n + 1 ),
			} ),
			{
				// View booking is the row's quick-access action: it
				// surfaces as a hover-revealed icon button next to the
				// kebab (DataViews' `isPrimary` rendering). It is also
				// hidden from the kebab dropdown via the marker class
				// set by `startRowActionsMenuMarker()` in index.js, to
				// avoid duplicating the inline button. The canonical
				// order still slots View booking at position 7 for any
				// future surface that lists every action.
				id: 'view-booking',
				label: __( 'View booking', 'woocommerce-bookings' ),
				isPrimary: true,
				icon: seen,
				isEligible: () => true,
				supportsBulk: false,
				callback: ( items ) => {
					const item = items[ 0 ];
					const url = item?.detail_url || item?.edit_url;
					if ( url ) window.location.href = url;
				},
			},
			{
				id: 'view-order',
				label: __( 'View order', 'woocommerce-bookings' ),
				callback: ( items ) => {
					const item = items[ 0 ];
					if ( item?.order?.edit_url ) window.location.href = item.order.edit_url;
				},
				isEligible: ( item ) => !! item?.order,
			},
			{
				id: 'refund',
				label: __( 'Refund', 'woocommerce-bookings' ),
				// Refund is only meaningful once the order has actually
				// been paid — WC's refund form just shows "$0.00 available"
				// otherwise. Gate on `order.date_paid` so the action
				// disappears from the kebab for unpaid / pending orders.
				isEligible: ( item ) => !! item?.order?.date_paid,
				// Defer to WooCommerce's existing refund UI on the order
				// edit screen rather than duplicating the flow. The hash
				// is picked up by WC_Bookings_DataViews_Refund_Redirect,
				// which auto-clicks WC's native `Refund` button on load.
				callback: ( items ) => {
					const url = items[ 0 ]?.order?.edit_url;
					if ( url ) {
						window.location.href = url + '#wc-bookings-dv-refund';
					}
				},
			},
			{
				id: 'cancel',
				label: __( 'Cancel', 'woocommerce-bookings' ),
				supportsBulk: true,
				isDestructive: true,
				// CIAB: hide once paid (refund instead) or settled. Cancel
				// is only meaningful for pre-payment / pre-completion states.
				isEligible: ( item ) => {
					const s = item?.status;
					return s !== 'cancelled' && s !== 'paid' && s !== 'complete' && s !== 'refunded';
				},
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/cancel',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
		],
		[ setRefreshToken, createInfoNotice ]
	);

	const defaultLayouts = useMemo( () => ( { table: {} } ), [] );

	const clearFilters = () => {
		setView( ( v ) => ( { ...v, search: '', filters: [], page: 1 } ) );
	};

	const tabsNode = (
		<Tabs.Root
			value={ tab }
			onValueChange={ ( value ) => {
				setTab( value );
				setView( ( v ) => ( { ...v, page: 1, sort: TAB_DEFAULT_SORT[ value ] } ) );
			} }
			className="wc-bookings-dv-tabs"
		>
			<Tabs.List>
				{ TABS.map( ( t ) => (
					<Tabs.Tab key={ t.id } value={ t.id }>
						{ t.label }
					</Tabs.Tab>
				) ) }
			</Tabs.List>
		</Tabs.Root>
	);

	return (
		<div ref={ rootRef }>
			<DataViews
				data={ data }
				fields={ fields }
				view={ view }
				onChangeView={ setView }
				actions={ actions }
				defaultLayouts={ defaultLayouts }
				paginationInfo={ totals }
				isLoading={ isLoading }
				getItemId={ ( item ) => String( item.id ) }
				renderItemLink={ ( { item, ...props } ) => (
					<a href={ item.detail_url || item.edit_url } { ...props } />
				) }
				empty={
					<BookingEmptyState
						slug={ tab }
						view={ view }
						onClearFilters={ clearFilters }
					/>
				}
				search
			/>
			{ toolbarEl && createPortal( tabsNode, toolbarEl ) }
		</div>
	);
}
