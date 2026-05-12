import { useEffect, useMemo, useRef, useState, createPortal } from '@wordpress/element';
import { DataViews } from '@wordpress/dataviews';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __ } from '@wordpress/i18n';
import { Tabs, Link } from '@wordpress/ui';
import { buildFields } from './fields';

if ( window.WC_BOOKINGS_DATAVIEWS_DATA?.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( window.WC_BOOKINGS_DATAVIEWS_DATA.nonce ) );
}

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl;

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
		'status',
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
			start_date: 'start_date',
			end_date: 'end_date',
			total: 'total',
		};
		params.orderby = map[ view.sort.field ] || 'booking_id';
		params.order = view.sort.direction || 'desc';
	}
	const status = firstFilterValue( view.filters, 'status' );
	if ( status ) params.status = status;
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
	const [ view, setView ] = useState( DEFAULTS );
	const [ tab, setTab ] = useState( 'upcoming' );
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
	}, [ tab, view.page, view.perPage, view.search, view.sort?.field, view.sort?.direction, JSON.stringify( view.filters ), refreshToken ] );

	const fields = useMemo( () => buildFields( options ), [ options ] );

	const actions = useMemo(
		() => [
			{
				id: 'edit',
				label: __( 'Edit', 'woocommerce-bookings' ),
				isPrimary: true,
				callback: ( items ) => {
					const item = items[ 0 ];
					if ( item?.edit_url ) window.location.href = item.edit_url;
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
		],
		[ setRefreshToken ]
	);

	const defaultLayouts = useMemo( () => ( { table: {} } ), [] );

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
				search
			/>
			{ toolbarEl && createPortal( tabsNode, toolbarEl ) }
		</div>
	);
}
