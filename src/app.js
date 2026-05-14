import { useCallback, useEffect, useMemo, useRef, useState, createPortal } from '@wordpress/element';
import { DataViews } from '@wordpress/dataviews';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __ } from '@wordpress/i18n';
import { Tabs, Link } from '@wordpress/ui';
import { seen } from '@wordpress/icons';
import { dispatch, select, useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { store as preferencesStore } from '@wordpress/preferences';
import { create as createPersistenceLayer } from '@wordpress/preferences-persistence';
import { buildFields } from './fields';
import { BookingEmptyState } from './empty-state';

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

const DEFAULTS = {
	type: 'table',
	perPage: 20,
	page: 1,
	search: '',
	filters: [],
	sort: { field: 'start_date', direction: 'asc' },
	// Column order after the title field (Booking #):
	// Date and time, Booked Product, Resources, Persons, Customer, Status, Attendance, Payment, Total.
	// `id` is the title field (rendered separately via renderItemLink),
	// so it must NOT also appear in this list.
	fields: [
		'start_date',
		'product',
		'resource',
		'num_of_persons',
		'customer',
		'booking_status',
		'attendance_status',
		'payment_status',
		'total',
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

// setDefaults is sync (first useSelect read returns DEFAULTS); setPersistenceLayer
// is async — App awaits the promise before fetching, so we fetch with the persisted
// view in one shot rather than fetching with defaults then refetching post-hydration.
dispatch( preferencesStore ).setDefaults( PREFS_SCOPE, {
	[ VIEW_PREF ]: DEFAULTS,
	[ TAB_PREF ]: 'upcoming',
} );
const persistenceReady = dispatch( preferencesStore ).setPersistenceLayer(
	createPersistenceLayer()
);

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
	const product = firstFilterValue( view.filters, 'product' );
	if ( product ) params.product = product;
	const resource = firstFilterValue( view.filters, 'resource' );
	if ( resource ) params.resource = resource;
	const startRange = firstFilterValue( view.filters, 'start_date' );
	if ( startRange ) params.start_range = startRange;
	const endRange = firstFilterValue( view.filters, 'end_date' );
	if ( endRange ) params.end_range = endRange;
	const attendance = firstFilterValue( view.filters, 'attendance_status' );
	if ( attendance ) params.attendance = attendance;
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
			if ( typeof nextOrUpdater === 'function' ) {
				const current =
					select( preferencesStore ).get( PREFS_SCOPE, VIEW_PREF ) ||
					DEFAULTS;
				setPreference( PREFS_SCOPE, VIEW_PREF, nextOrUpdater( current ) );
			} else {
				setPreference( PREFS_SCOPE, VIEW_PREF, nextOrUpdater );
			}
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

	// Order mirrors CIAB's row Actions menu exactly:
	//   View booking → Mark as attended/unattended → Mark as paid →
	//   Cancel → View order → View customer profile → Refund.
	// Confirm / Refuse are WC-Bookings-specific (no pending-confirmation
	// status in CIAB) and live at the end of the menu.
	// Reschedule is intentionally NOT here — CIAB doesn't expose it in
	// the list, only in the detail-page kebab.
	const actions = useMemo(
		() => [
			{
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
				id: 'mark-attended',
				label: __( 'Mark as attended', 'woocommerce-bookings' ),
				supportsBulk: true,
				isEligible: ( item ) =>
					!! item?.is_past && item?.attendance_status === 'unattended',
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
				isEligible: ( item ) =>
					!! item?.is_past && item?.attendance_status === 'attended',
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
				isEligible: ( item ) => {
					const s = item?.status;
					return s !== 'paid' && s !== 'complete' && s !== 'cancelled' && s !== 'refunded';
				},
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/mark-paid',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
				},
			},
			{
				id: 'cancel',
				label: __( 'Cancel', 'woocommerce-bookings' ),
				supportsBulk: true,
				isDestructive: true,
				isEligible: ( item ) =>
					item?.status !== 'cancelled' && item?.status !== 'complete',
				callback: ( items ) => {
					apiFetch( {
						path: REST_BASE + 'bookings/cancel',
						method: 'POST',
						data: { ids: items.map( ( i ) => i.id ) },
					} ).then( () => setRefreshToken( ( n ) => n + 1 ) ).catch( () => {} );
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
				isEligible: ( item ) => !! item?.order,
				callback: () => {
					createInfoNotice(
						__( 'Refund is coming soon.', 'woocommerce-bookings' ),
						{ type: 'snackbar' }
					);
				},
			},
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
					<Link href={ item.detail_url || item.edit_url } { ...props } />
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
