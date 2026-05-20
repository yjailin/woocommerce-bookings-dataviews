import { __ } from '@wordpress/i18n';
import { createElement as h } from '@wordpress/element';
import { Badge } from '@wordpress/ui';

// Payment is derived from the underlying order, not the booking status.
// Returns one of: null (no order → "N/A"), 'cancelled' (cancelled order
// that was never paid → "—"), or 'paid' / 'unpaid' / 'refunded' (badges).
// Cancelled + previously paid stays "Paid" because the money is still
// owed back to the customer until a refund is issued.
export function paymentStateFor( item ) {
	if ( ! item.order ) {
		return null;
	}
	const status = item.order.status;
	if ( status === 'refunded' ) {
		return 'refunded';
	}
	if ( status === 'cancelled' ) {
		return item.order.date_paid ? 'paid' : 'cancelled';
	}
	if ( status === 'processing' || status === 'completed' ) {
		return 'paid';
	}
	return 'unpaid';
}

export const PAYMENT_MAP = {
	paid: { label: __( 'Paid', 'woocommerce-bookings' ), intent: 'none' },
	unpaid: { label: __( 'Unpaid', 'woocommerce-bookings' ), intent: 'low' },
	refunded: { label: __( 'Refunded', 'woocommerce-bookings' ), intent: 'none' },
};

// Filter options mirror the badges the Payment column can actually display.
const PAYMENT_OPTIONS = [
	{ value: 'paid', label: __( 'Paid', 'woocommerce-bookings' ) },
	{ value: 'unpaid', label: __( 'Unpaid', 'woocommerce-bookings' ) },
	{ value: 'refunded', label: __( 'Refunded', 'woocommerce-bookings' ) },
];

const ATTENDANCE_OPTIONS = [
	{ value: 'attended', label: __( 'Attended', 'woocommerce-bookings' ) },
	{ value: 'unattended', label: __( 'Unattended', 'woocommerce-bookings' ) },
];

const DATE_PRESETS = [
	{ value: 'today', label: __( 'Today', 'woocommerce-bookings' ) },
	{ value: 'tomorrow', label: __( 'Tomorrow', 'woocommerce-bookings' ) },
	{ value: 'this_week', label: __( 'This week', 'woocommerce-bookings' ) },
	{ value: 'this_month', label: __( 'This month', 'woocommerce-bookings' ) },
	{ value: 'upcoming', label: __( 'Upcoming', 'woocommerce-bookings' ) },
	{ value: 'past_30', label: __( 'Past 30 days', 'woocommerce-bookings' ) },
	{ value: 'next_30', label: __( 'Next 30 days', 'woocommerce-bookings' ) },
];

export function buildFields( { products = [], resources = [] } = {} ) {
	return [
		// Identity
		{
			id: 'id',
			label: __( 'Booking #', 'woocommerce-bookings' ),
			enableHiding: false,
			enableSorting: true,
			// As the title field, DataViews wraps the cell content
			// with the `renderItemLink` from <DataViews>. We just
			// return the visible text here.
			render: ( { item } ) => `#${ item.id }`,
		},
		{
			id: 'booking_status',
			label: __( 'Status', 'woocommerce-bookings' ),
			enableSorting: false,
			elements: [
				{ value: 'pending-confirmation', label: __( 'Pending', 'woocommerce-bookings' ) },
				{ value: 'cancelled', label: __( 'Canceled', 'woocommerce-bookings' ) },
			],
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.status,
			// Only render a badge for non-default booking states.
			// Active bookings (confirmed/paid/complete/etc.) don't get a
			// dedicated badge — showing "Confirmed" on every row would be
			// noise — but fall back to an em-dash so the cell isn't
			// visually empty. Every other column in the list view uses
			// the same em-dash placeholder for missing values; keep
			// Status consistent rather than leaving a blank cell.
			render: ( { item } ) => {
				if ( item.status === 'cancelled' ) {
					return h( Badge, { intent: 'informational' }, __( 'Canceled', 'woocommerce-bookings' ) );
				}
				if ( item.status === 'pending-confirmation' ) {
					return h( Badge, { intent: 'low' }, __( 'Pending', 'woocommerce-bookings' ) );
				}
				return h( 'span', null, '—' );
			},
		},
		// Who
		{
			id: 'resource',
			label: __( 'Resource', 'woocommerce-bookings' ),
			elements: resources,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.product?.resource?.id || '',
			render: ( { item } ) =>
				h( 'span', null, item.product?.resource ? item.product.resource.name : '—' ),
			enableSorting: true,
		},
		{
			id: 'customer',
			label: __( 'Customer', 'woocommerce-bookings' ),
			enableSorting: true,
			getValue: ( { item } ) => item.customer?.name || '',
			render: ( { item } ) =>
				h( 'span', null, item.customer?.name || '—' ),
		},
		{
			id: 'num_of_persons',
			label: __( 'Person(s)', 'woocommerce-bookings' ),
			getValue: ( { item } ) => item.num_of_persons ?? '',
			render: ( { item } ) =>
				item.num_of_persons == null
					? h( 'span', null, '—' )
					: h( 'span', null, String( item.num_of_persons ) ),
		},
		// When
		{
			id: 'start_date',
			label: __( 'Date and time', 'woocommerce-bookings' ),
			enableSorting: true,
			elements: DATE_PRESETS,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.start_date,
			render: ( { item } ) => h( 'span', null, item.start_date ),
		},
		{
			id: 'end_date',
			label: __( 'End Date', 'woocommerce-bookings' ),
			enableSorting: true,
			elements: DATE_PRESETS,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.end_date,
			render: ( { item } ) => h( 'span', null, item.end_date ),
		},
		// State / financial
		{
			id: 'attendance_status',
			label: __( 'Attendance', 'woocommerce-bookings' ),
			elements: ATTENDANCE_OPTIONS,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.attendance_status || 'unattended',
			// Mirror CIAB: every non-cancelled booking shows an attendance
			// badge — "Attended" once explicitly marked, "Unattended" by
			// default (including for future bookings). Cancelled bookings
			// render as "—" since attendance isn't meaningful for them.
			render: ( { item } ) => {
				if ( item.status === 'cancelled' ) {
					return h( 'span', null, '—' );
				}
				if ( item.attendance_status === 'attended' ) {
					return h( Badge, { intent: 'none' }, __( 'Attended', 'woocommerce-bookings' ) );
				}
				return h( Badge, { intent: 'draft' }, __( 'Unattended', 'woocommerce-bookings' ) );
			},
		},
		{
			id: 'payment_status',
			label: __( 'Payment', 'woocommerce-bookings' ),
			enableSorting: false,
			elements: PAYMENT_OPTIONS,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => paymentStateFor( item ) || '',
			render: ( { item } ) => {
				const state = paymentStateFor( item );
				const map = state ? PAYMENT_MAP[ state ] : null;
				if ( ! map ) return h( 'span', null, '—' );
				return h( Badge, { intent: map.intent }, map.label );
			},
		},
		{
			id: 'order',
			label: __( 'Order', 'woocommerce-bookings' ),
			getValue: ( { item } ) => item.order?.number || '',
			render: ( { item } ) =>
				item.order
					? h(
							'a',
							{ href: item.order.edit_url, className: 'bdv-cell-link' },
							`#${ item.order.number }`
					  )
					: h( 'span', null, '—' ),
		},
		{
			id: 'total',
			label: __( 'Total', 'woocommerce-bookings' ),
			enableSorting: true,
			getValue: ( { item } ) => item.total ?? 0,
			render: ( { item } ) => h( 'span', null, item.total_display || '—' ),
		},
		// What
		{
			id: 'product',
			label: __( 'Booked Product', 'woocommerce-bookings' ),
			enableSorting: true,
			elements: products,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.product?.id || '',
			render: ( { item } ) =>
				h( 'span', null, item.product ? item.product.title : '—' ),
		},
	];
}
