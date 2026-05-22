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

// State merges the old booking_status and attendance_status into a single
// lifecycle-aware view:
//   • Before start: Pending Confirmation / Confirmed / Canceled
//   • At/after start: Pending Confirmation (if unresolved) / Attended /
//     Unattended / Canceled, or em-dash until the merchant explicitly marks
//     attendance.
// Rules (cancelled always short-circuits — see filter logic in
// class-wc-bookings-dataviews-rest.php for the matching server-side guard):
//   • status='cancelled' → Canceled (any time, any attendance).
//   • status='pending-confirmation' → Pending (persists across the start
//     boundary because it's an unresolved state, not a lifecycle state).
//   • Future bookings → Confirmed (attendance is invisible until start —
//     pre-marks land in the DB but show no badge).
//   • Past bookings → only show Attended/Unattended when attendance_status
//     is explicitly set. Bookings with no attendance recorded render as
//     em-dash; the merchant resolves them via Mark as attended / unattended.
// The string values here double as filter keys and must match the server's
// `?state=` parameter in class-wc-bookings-dataviews-rest.php.
export function stateFor( item, nowSeconds = Date.now() / 1000 ) {
	if ( ! item ) {
		return null;
	}
	if ( item.status === 'cancelled' ) {
		return 'cancelled';
	}
	if ( item.status === 'pending-confirmation' ) {
		return 'pending-confirmation';
	}
	const start = Number( item.start ) || 0;
	if ( start === 0 || start > nowSeconds ) {
		return 'confirmed';
	}
	if ( item.attendance_status === 'attended' ) {
		return 'attended';
	}
	if ( item.attendance_status === 'unattended' ) {
		return 'unattended';
	}
	return null;
}

export const STATE_MAP = {
	'pending-confirmation': {
		label: __( 'Pending', 'woocommerce-bookings' ),
		intent: 'low',
	},
	confirmed: {
		label: __( 'Confirmed', 'woocommerce-bookings' ),
		// `none` is the design-system-recommended intent for normal
		// background states in dense lists (see
		// @wordpress/ui/src/badge/stories/choosing-intent.mdx — "Approved →
		// none" is the worked example). White-with-border keeps the
		// Upcoming tab scannable without flooding the column with green.
		intent: 'none',
	},
	cancelled: {
		label: __( 'Canceled', 'woocommerce-bookings' ),
		intent: 'informational',
	},
	attended: {
		label: __( 'Attended', 'woocommerce-bookings' ),
		intent: 'none',
	},
	unattended: {
		label: __( 'Unattended', 'woocommerce-bookings' ),
		intent: 'draft',
	},
};

const STATE_OPTIONS = [
	{ value: 'pending-confirmation', label: __( 'Pending', 'woocommerce-bookings' ) },
	{ value: 'confirmed', label: __( 'Confirmed', 'woocommerce-bookings' ) },
	{ value: 'cancelled', label: __( 'Canceled', 'woocommerce-bookings' ) },
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
			id: 'state',
			label: __( 'State', 'woocommerce-bookings' ),
			enableSorting: false,
			elements: STATE_OPTIONS,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => stateFor( item ) || '',
			render: ( { item } ) => {
				const state = stateFor( item );
				const map = state ? STATE_MAP[ state ] : null;
				if ( ! map ) {
					return h( 'span', null, '—' );
				}
				return h( Badge, { intent: map.intent }, map.label );
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
