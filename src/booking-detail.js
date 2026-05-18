/**
 * Booking detail page.
 *
 * Form structure mirrors the CIAB view config registered in
 * `woocommerce_bookings_next_register_default_view_config_for_booking()`:
 *
 *   Card 1 — "Booking details"     (always open)
 *     summary: attendance_status (visibility: always)
 *     children:
 *       booking-service-info               (panel, no label)
 *       booking-date-time                  (panel, label top)
 *       resource                           (panel, label top)  ← CIAB's team_member_name
 *       booking-actions-button-group       (regular, no label) Reschedule · Mark attended · Mark unattended
 *
 *   Card 2 — "Payment"             (always open)
 *     summary: total + status (always)
 *     children:
 *       booking_payment_breakdown          (regular, no label) line items + total
 *       booking-order-actions-button-group (regular, no label) View order · Refund · Mark as paid
 *
 *   Card 3 — "Customer"            (collapsed: isOpened false)
 *     summary: customer
 *     children:
 *       booking_customer_details           (regular, no label) name + email + phone composite
 *
 *   Card 4 — "Booking note"        (collapsed: isOpened false)
 *     description: "This is a private note. It'll not be shared with the customer."
 *     children:
 *       note                               (regular, no label)
 *
 * Field id naming follows CIAB exactly (hyphen-separated for "button group"
 * renderers, snake_case for content composites — matches the PHP config).
 *
 * Editable fields (`note` for now) flow through a local `pendingEdits`
 * buffer in `BookingDetail` — DataForm writes to the buffer on change, the
 * Save button in the page header flushes the buffer through the
 * `bookings/update` REST endpoint, and `pendingEdits` is cleared after a
 * successful save.
 *
 * Skipped vs. CIAB:
 *   • `booking_location` — WC Bookings core has no booking-level location.
 *   • `useTrack` / `useTrackedModal` — telemetry, not needed here.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Spinner, Notice, DropdownMenu } from '@wordpress/components';
import { Page, Breadcrumbs } from '@wordpress/admin-ui';
import { AlertDialog, Badge, Button, Stack } from '@wordpress/ui';
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router';
import { DataForm } from '@wordpress/dataviews';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { Icon, box, mapMarker, moreVertical } from '@wordpress/icons';
import { __experimentalInputControl as InputControl } from '@wordpress/components';
import { buildFields, paymentStateFor, PAYMENT_MAP } from './fields';
import {
	RescheduleBookingDialog,
	isRescheduleEligible,
} from './reschedule-booking';

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl || '';
const LIST_URL = window.WC_BOOKINGS_DATAVIEWS_DATA?.listUrl || '';

// =============================================================================
// Context — used by inline card action buttons to trigger a refetch on the
// parent after a successful action. Avoids prop-drilling through DataForm.
// =============================================================================

const BookingDetailContext = createContext( {
	onRefresh: () => {},
	openReschedule: () => {},
} );

// =============================================================================
// Header helpers
// =============================================================================

// Header badge derived from the underlying order. The list view's Payment
// column shows "N/A" / "—" for the no-order and cancelled-never-paid
// cases; in the header those collapse to "no badge" since standalone
// placeholder text doesn't belong next to the booking ID.
function getPaymentBadge( booking ) {
	const state = paymentStateFor( booking );
	if ( ! state ) return null;
	return PAYMENT_MAP[ state ] || null;
}

const ATTENDANCE_FIELD = buildFields().find(
	( f ) => f.id === 'attendance_status'
);

function HeaderBadges( { booking } ) {
	const isCancelled = booking.status === 'cancelled';
	const pBadge = getPaymentBadge( booking );

	return (
		<>
			{ isCancelled ? (
				<Badge intent="informational">
					{ __( 'Canceled', 'woocommerce-bookings' ) }
				</Badge>
			) : (
				ATTENDANCE_FIELD?.render && (
					<ATTENDANCE_FIELD.render
						item={ booking }
						field={ ATTENDANCE_FIELD }
					/>
				)
			) }
			{ pBadge && (
				<Badge intent={ pBadge.intent }>{ pBadge.label }</Badge>
			) }
		</>
	);
}

// @wordpress/admin-ui's <Breadcrumbs> uses <Link> from @wordpress/route, which
// re-exports from @tanstack/react-router. Link requires a router context. This
// WP admin page is not a TanStack-routed app, so we provide a minimal in-memory
// router whose only purpose is to satisfy that context dependency. The router
// detects absolute URLs (LIST_URL) as external and renders them as plain <a>
// elements, so navigation still happens via full page loads.
//
// The router renders its routeTree's root component. We use a context-bridge
// pattern so the root component pulls its content from React context — that
// way the booking detail content lives inside the RouterProvider subtree (and
// can therefore use Link) while still receiving props from the outer caller.
const RouterContentContext = createContext( null );
function RouterContentBridge() {
	return useContext( RouterContentContext );
}
function createDetailRouter() {
	return createRouter( {
		routeTree: createRootRoute( { component: RouterContentBridge } ),
		history: createMemoryHistory( { initialEntries: [ '/' ] } ),
		defaultNotFoundComponent: () => null,
	} );
}

function BookingBreadcrumbs( { bookingId } ) {
	return (
		<Breadcrumbs
			items={ [
				{
					label: __( 'All Bookings', 'woocommerce-bookings' ),
					to: LIST_URL,
				},
				{
					label: sprintf(
						/* translators: %d: booking ID */
						__( '#%d', 'woocommerce-bookings' ),
						bookingId
					),
				},
			] }
		/>
	);
}

function getSubtitle( booking ) {
	const parts = [];
	if ( booking.start_date ) {
		let range = booking.start_date;
		if ( booking.end_date && booking.end_date !== booking.start_date ) {
			const endLabel =
				booking.is_same_day && booking.end_time_display
					? booking.end_time_display
					: booking.end_date;
			range += ' – ' + endLabel;
		}
		parts.push( range );
	}
	if ( booking.customer?.name ) parts.push( booking.customer.name );
	return parts.join( ' · ' );
}

function getDateTimeStringFromBooking( booking ) {
	if ( ! booking.start_date_only_display ) {
		return '—';
	}
	// Core WC Bookings never shows times for all-day bookings — see
	// WC_Booking::get_start_date()'s is_all_day() branch.
	if ( booking.all_day ) {
		if ( booking.end_date && booking.end_date !== booking.start_date ) {
			return booking.start_date_only_display + ' – ' + booking.end_date;
		}
		return booking.start_date_only_display;
	}
	if ( ! booking.start_time_display ) {
		return '—';
	}
	return (
		booking.start_date_only_display +
		' · ' +
		booking.start_time_display +
		( booking.end_time_display ? ' - ' + booking.end_time_display : '' )
	);
}

// =============================================================================
// Action runner — used by inline card action buttons and page-level Cancel
// =============================================================================

function useBookingActionRunner( bookingId ) {
	const { onRefresh } = useContext( BookingDetailContext );
	const [ pending, setPending ] = useState( null );
	const { createSuccessNotice, createInfoNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const run = useCallback(
		( action ) => {
			// Unimplemented (`endpoint: null`) actions surface in the UI for
			// CIAB parity but have no backing endpoint here. Use an info
			// notice — success styling would mis-signal that something
			// actually happened.
			if ( ! action.endpoint ) {
				createInfoNotice(
					action.notImplementedMessage ||
						__(
							"This action isn't available yet.",
							'woocommerce-bookings'
						),
					{ type: 'snackbar' }
				);
				return;
			}
			setPending( action.id );
			apiFetch( {
				path: REST_BASE + action.endpoint,
				method: 'POST',
				data: { ids: [ Number( bookingId ) ] },
			} )
				.then( () => {
					// Actions that take the user elsewhere (e.g. Cancel
					// returns them to the list) skip the in-page refresh
					// and skip the snackbar — the navigation itself is the
					// confirmation.
					if ( action.redirectTo ) {
						window.location.href = action.redirectTo;
						return;
					}
					createSuccessNotice( action.successMessage, {
						type: 'snackbar',
					} );
					onRefresh();
				} )
				.catch( ( err ) => {
					createErrorNotice(
						err?.message ||
							__(
								'The action could not be completed.',
								'woocommerce-bookings'
							),
						{ type: 'snackbar' }
					);
				} )
				.finally( () => {
					// Don't clear pending if we're navigating away — the
					// button should stay in the "busy" state until the
					// browser actually leaves the page.
					if ( ! action.redirectTo ) {
						setPending( null );
					}
				} );
		},
		[
			bookingId,
			createSuccessNotice,
			createInfoNotice,
			createErrorNotice,
			onRefresh,
		]
	);

	return { pending, run };
}

// =============================================================================
// Composite field renderers (used as field `render` in the field collection)
// =============================================================================

/**
 * ServiceInfoRender — product thumbnail + name + human-readable duration.
 * Mirrors CIAB's `ServiceInfoRender`.
 */
function ServiceInfoRender( { item } ) {
	const thumbnail = item.product?.thumbnail;
	const productName = item.product?.title || '—';
	const duration = item.duration_display || '';
	const label = duration ? productName + ' · ' + duration : productName;
	return (
		<Stack
			direction="row"
			align="center"
			gap="sm"
			className="wc-bookings-dv-detail__service-info"
		>
			{ thumbnail ? (
				<img
					src={ thumbnail }
					alt=""
					className="wc-bookings-dv-detail__service-info-image"
				/>
			) : (
				<span
					className="wc-bookings-dv-detail__service-info-placeholder"
					aria-label={ __( 'No image', 'woocommerce-bookings' ) }
				>
					<Icon icon={ box } />
				</span>
			) }
			<span>{ label }</span>
		</Stack>
	);
}

function DateTimeRender( { item } ) {
	return <span>{ getDateTimeStringFromBooking( item ) }</span>;
}

/**
 * BookingPaymentBreakdown — line items + tax + discount + total.
 * Mirrors CIAB's `booking-payment-dataviews` table: a header row with an
 * "Amount" column, each order line item, then tax and discount totals,
 * then a separated Total row at the bottom.
 */
function BookingPaymentBreakdown( { item } ) {
	const order = item.order;
	const fallbackLine = {
		id: 'fallback',
		name:
			item.product?.title ||
			__( 'Service', 'woocommerce-bookings' ),
		total_display: item.total_display || '—',
	};
	const lineItems =
		order?.line_items && order.line_items.length > 0
			? order.line_items
			: [ fallbackLine ];
	const totalDisplay =
		order?.total_display || item.total_display || '—';
	// Currency-correct "$0.00" fallback for Tax / Discount when no
	// order is associated: take the booking's own total_display string
	// and swap the numeric portion for "0.00" so the symbol/locale are
	// preserved.
	const zeroPrice = ( item.total_display || '0.00' ).replace(
		/[\d,.]+/,
		'0.00'
	);
	return (
		<table className="wc-bookings-dv-detail__payment-breakdown">
			<thead>
				<tr>
					<th scope="col">
						{ __( 'Price breakdown', 'woocommerce-bookings' ) }
					</th>
					<th scope="col">
						{ __( 'Amount', 'woocommerce-bookings' ) }
					</th>
				</tr>
			</thead>
			<tbody>
				{ lineItems.map( ( li ) => (
					<tr key={ li.id }>
						<th scope="row">{ li.name }</th>
						<td>{ li.total_display }</td>
					</tr>
				) ) }
				<tr>
					<th scope="row">
						{ __( 'Tax', 'woocommerce-bookings' ) }
					</th>
					<td>{ order?.total_tax_display || zeroPrice }</td>
				</tr>
				<tr>
					<th scope="row">
						{ __( 'Discount', 'woocommerce-bookings' ) }
					</th>
					<td>{ order?.discount_total_display || zeroPrice }</td>
				</tr>
			</tbody>
			<tfoot>
				<tr className="wc-bookings-dv-detail__payment-breakdown__total">
					<th scope="row">
						{ __( 'Total', 'woocommerce-bookings' ) }
					</th>
					<td>{ totalDisplay }</td>
				</tr>
			</tfoot>
		</table>
	);
}

/**
 * Compose the three-line billing-address summary shown in the panel
 * row. CIAB stacks "name", "address", and "phone" as separate lines
 * inside the trigger, so the read-only view still resembles a postal
 * address block. The first defined line gates whether the row renders
 * the full block — if there's no billing data at all, the caller falls
 * back to an em-dash.
 */
function getBillingSummaryLines( b ) {
	if ( ! b ) return null;
	const name = [ b.first_name, b.last_name ].filter( Boolean ).join( ' ' );
	const address = [
		[ b.address_1, b.address_2 ].filter( Boolean ).join( ', ' ),
		[
			b.city,
			[ b.state, b.postcode ].filter( Boolean ).join( ' ' ),
		]
			.filter( Boolean )
			.join( ', ' ),
	]
		.filter( Boolean )
		.join( ', ' );
	const phone = b.phone || '';
	if ( ! name && ! address && ! phone ) return null;
	return { name, address, phone };
}

/**
 * Build the field collection for the nested customer DataForm. Each
 * billing field is a path-aware leaf (custom `getValue` + `setValue`
 * walking into `item.order.billing.*`) so DataForm reads and writes the
 * nested shape correctly. The two `*_summary` entries are virtual: they
 * render the read-only summary text shown next to the panel's pencil
 * icon and aren't editable themselves.
 */
const DASH = '—';

function buildCustomerCardFields() {
	const makeBilling = ( key, label, type = 'text', extras = {} ) => ( {
		id: `billing_${ key }`,
		type,
		label,
		getValue: ( { item } ) => item.order?.billing?.[ key ] ?? '',
		setValue: ( { item, value } ) => ( {
			order: {
				...item.order,
				billing: { ...item.order?.billing, [ key ]: value },
			},
		} ),
		render: ( { item } ) =>
			item.order?.billing?.[ key ] || DASH,
		...extras,
	} );

	// Custom Edit for the address line inside the Billing modal. Mirrors
	// CIAB's `AddressAutocompleteField` fallback (when the autocomplete
	// service isn't available, CIAB renders a plain `InputControl`) plus
	// the same `mapMarker` prefix the autocomplete variant uses. We don't
	// have @automattic/design-system's `InputLayout.Slot` here — the
	// `wc-bookings-dv-detail__field-prefix` class approximates its
	// "minimal" padding and neutral-weak color in plain CSS.
	const AddressLineEdit = ( { data, field, onChange } ) => {
		const value = field.getValue( { item: data } ) ?? '';
		return (
			<InputControl
				label={ field.label }
				value={ value }
				onChange={ ( next ) =>
					onChange(
						field.setValue( {
							item: data,
							value: next ?? '',
						} )
					)
				}
				prefix={
					<span className="wc-bookings-dv-detail__field-prefix">
						<Icon icon={ mapMarker } />
					</span>
				}
				__next40pxDefaultSize
			/>
		);
	};

	return [
		{
			id: 'customer-name',
			type: 'text',
			label: __( 'Name', 'woocommerce-bookings' ),
			readOnly: true,
			getValue: ( { item } ) => item.customer?.name || '',
			render: ( { item } ) => (
				<div className="wc-bookings-dv-detail__customer-name">
					{ item.customer?.name || DASH }
				</div>
			),
		},
		{
			id: 'customer-registered',
			type: 'text',
			label: __( 'Customer status', 'woocommerce-bookings' ),
			readOnly: true,
			isVisible: ( item ) =>
				( item.customer?.user_id ?? 0 ) > 0,
			getValue: () => '',
			render: () => (
				<Badge intent="stable">
					{ __( 'Registered', 'woocommerce-bookings' ) }
				</Badge>
			),
		},
		{
			id: 'customer-note',
			type: 'text',
			label: __( 'Note', 'woocommerce-bookings' ),
			readOnly: true,
			getValue: ( { item } ) => item.order?.note || '',
			render: ( { item } ) => item.order?.note || DASH,
		},
		makeBilling( 'email', __( 'Email', 'woocommerce-bookings' ), 'email' ),
		{
			id: 'billing_summary',
			type: 'text',
			label: __( 'Billing summary', 'woocommerce-bookings' ),
			readOnly: true,
			getValue: ( { item } ) => {
				const lines = getBillingSummaryLines( item.order?.billing );
				return lines
					? [ lines.name, lines.address, lines.phone ]
							.filter( Boolean )
							.join( ' · ' )
					: '';
			},
			render: ( { item } ) => {
				const lines = getBillingSummaryLines( item.order?.billing );
				if ( ! lines ) return DASH;
				return (
					<span className="wc-bookings-dv-detail__billing-summary">
						<span>{ lines.name || DASH }</span>
						<span>{ lines.address || DASH }</span>
						<span>{ lines.phone || DASH }</span>
					</span>
				);
			},
		},
		makeBilling( 'first_name', __( 'First name', 'woocommerce-bookings' ) ),
		makeBilling( 'last_name', __( 'Last name', 'woocommerce-bookings' ) ),
		makeBilling( 'company', __( 'Company', 'woocommerce-bookings' ) ),
		makeBilling( 'country', __( 'Country', 'woocommerce-bookings' ) ),
		makeBilling( 'address_1', __( 'Address line 1', 'woocommerce-bookings' ), 'text', {
			Edit: AddressLineEdit,
		} ),
		makeBilling( 'address_2', __( 'Address line 2', 'woocommerce-bookings' ) ),
		makeBilling( 'city', __( 'City', 'woocommerce-bookings' ) ),
		makeBilling( 'state', __( 'State', 'woocommerce-bookings' ) ),
		makeBilling( 'postcode', __( 'Postcode', 'woocommerce-bookings' ) ),
		makeBilling( 'phone', __( 'Phone', 'woocommerce-bookings' ), 'telephone' ),
	];
}

const CUSTOMER_CARD_FORM = {
	fields: [
		{
			id: '_customer-header',
			layout: { type: 'row' },
			children: [
				{
					id: 'customer-name',
					layout: { type: 'regular', labelPosition: 'none' },
				},
				{
					id: 'customer-registered',
					layout: { type: 'regular', labelPosition: 'none' },
				},
			],
		},
		{
			id: 'email-section',
			label: __( 'Email', 'woocommerce-bookings' ),
			layout: {
				type: 'panel',
				openAs: 'modal',
				labelPosition: 'top',
				summary: [ 'billing_email' ],
			},
			children: [
				{
					id: 'billing_email',
					layout: { type: 'regular', labelPosition: 'top' },
				},
			],
		},
		{
			id: 'billing-section',
			label: __( 'Billing information', 'woocommerce-bookings' ),
			layout: {
				type: 'panel',
				openAs: 'modal',
				labelPosition: 'top',
				summary: [ 'billing_summary' ],
			},
			children: [
				{
					id: '_first-last',
					layout: { type: 'row' },
					children: [
						{
							id: 'billing_first_name',
							layout: { type: 'regular', labelPosition: 'top' },
						},
						{
							id: 'billing_last_name',
							layout: { type: 'regular', labelPosition: 'top' },
						},
					],
				},
				{
					id: 'billing_company',
					layout: { type: 'regular', labelPosition: 'top' },
				},
				{
					id: 'billing_country',
					layout: { type: 'regular', labelPosition: 'top' },
				},
				{
					id: 'billing_address_1',
					layout: { type: 'regular', labelPosition: 'top' },
				},
				{
					id: 'billing_address_2',
					layout: { type: 'regular', labelPosition: 'top' },
				},
				{
					id: '_city-state',
					layout: { type: 'row' },
					children: [
						{
							id: 'billing_city',
							layout: { type: 'regular', labelPosition: 'top' },
						},
						{
							id: 'billing_state',
							layout: { type: 'regular', labelPosition: 'top' },
						},
					],
				},
				{
					id: '_postcode-phone',
					layout: { type: 'row' },
					children: [
						{
							id: 'billing_postcode',
							layout: { type: 'regular', labelPosition: 'top' },
						},
						{
							id: 'billing_phone',
							layout: { type: 'regular', labelPosition: 'top' },
						},
					],
				},
			],
		},
		{
			id: 'customer-note',
			layout: { type: 'regular', labelPosition: 'top' },
		},
	],
};

/**
 * Nested DataForm for the customer card. Each panel commits its own
 * changes through `/bookings/update` on Apply — independent of the
 * page-header Save (which only flushes the booking note). Mirrors
 * CIAB's `useCustomerDetailsForm` pattern.
 */
function BookingCustomerCard( { item } ) {
	const { onRefresh } = useContext( BookingDetailContext );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const fields = useMemo( () => buildCustomerCardFields(), [] );

	const handleChange = useCallback(
		( updater ) => {
			const merged =
				typeof updater === 'function' ? updater( item ) : updater;
			const billing = merged?.order?.billing;
			if ( ! billing ) return;
			apiFetch( {
				path: REST_BASE + 'bookings/update',
				method: 'POST',
				data: { id: item.id, fields: { billing } },
			} )
				.then( () => {
					createSuccessNotice(
						__(
							'Customer details updated.',
							'woocommerce-bookings'
						),
						{ type: 'snackbar' }
					);
					onRefresh();
				} )
				.catch( ( err ) => {
					createErrorNotice(
						err?.message ||
							__(
								'Failed to update customer details.',
								'woocommerce-bookings'
							),
						{ type: 'snackbar' }
					);
				} );
		},
		[ item, onRefresh, createSuccessNotice, createErrorNotice ]
	);

	return (
		<div className="wc-bookings-dv-detail__customer-card">
			<DataForm
				data={ item }
				fields={ fields }
				form={ CUSTOMER_CARD_FORM }
				onChange={ handleChange }
			/>
		</div>
	);
}

function NoteRender( { item } ) {
	if ( ! item.note ) {
		return (
			<span className="wc-bookings-dv-detail__note-empty">
				{ __( 'No note.', 'woocommerce-bookings' ) }
			</span>
		);
	}
	return <p className="wc-bookings-dv-detail__note">{ item.note }</p>;
}

/**
 * Inline action buttons inside the Booking details card.
 * Mirrors CIAB's `BookingActionsButtons` — Reschedule, Mark as attended,
 * Mark as unattended. Right-aligned Stack with `variant="minimal"` for the
 * lead action and `variant="outline"` for the followers.
 */
function BookingActionsButtons( { item } ) {
	const { pending, run } = useBookingActionRunner( item.id );
	const { openReschedule } = useContext( BookingDetailContext );
	const can = item.can || {};
	const canReschedule = isRescheduleEligible( item );

	const actions = [
		canReschedule && {
			id: 'reschedule',
			label: __( 'Reschedule', 'woocommerce-bookings' ),
			variant: 'minimal',
			onClick: openReschedule,
		},
		can.mark_attended && {
			id: 'mark-attended',
			label: __( 'Mark as attended', 'woocommerce-bookings' ),
			variant: 'outline',
			endpoint: 'bookings/mark-attended',
			successMessage: __(
				'Booking marked as attended.',
				'woocommerce-bookings'
			),
		},
		can.mark_unattended && {
			id: 'mark-unattended',
			label: __( 'Mark as unattended', 'woocommerce-bookings' ),
			variant: 'outline',
			endpoint: 'bookings/mark-unattended',
			successMessage: __(
				'Booking marked as unattended.',
				'woocommerce-bookings'
			),
		},
	].filter( Boolean );

	if ( actions.length === 0 ) return null;
	return (
		<Stack
			className="wc-bookings-dv-detail__action-row"
			direction="row"
			justify="flex-end"
			gap="sm"
		>
			{ actions.map( ( action ) => (
				<Button
					key={ action.id }
					variant={ action.variant }
					size="compact"
					onClick={ () =>
						action.onClick ? action.onClick() : run( action )
					}
					disabled={ pending !== null }
					loading={ pending === action.id }
				>
					{ action.label }
				</Button>
			) ) }
		</Stack>
	);
}

/**
 * Inline action buttons inside the Payment card.
 * Mirrors CIAB's `BookingOrderActionsButtons` — View order, Refund, Mark
 * as paid.
 */
function BookingOrderActionsButtons( { item } ) {
	const { pending, run } = useBookingActionRunner( item.id );
	const can = item.can || {};
	const orderUrl = item.order?.edit_url;
	const canRefund = !! item.order;

	const actions = [
		!! orderUrl && {
			id: 'view-order',
			label: __( 'View order', 'woocommerce-bookings' ),
			variant: 'minimal',
			type: 'link',
			href: orderUrl,
		},
		canRefund && {
			id: 'refund',
			label: __( 'Refund', 'woocommerce-bookings' ),
			variant: 'outline',
			endpoint: null,
			notImplementedMessage: __(
				'Refund is coming soon.',
				'woocommerce-bookings'
			),
		},
		can.mark_paid && {
			id: 'mark-paid',
			label: __( 'Mark as paid', 'woocommerce-bookings' ),
			variant: 'outline',
			endpoint: 'bookings/mark-paid',
			successMessage: __(
				'Booking marked as paid.',
				'woocommerce-bookings'
			),
		},
	].filter( Boolean );

	if ( actions.length === 0 ) return null;
	return (
		<Stack
			className="wc-bookings-dv-detail__action-row"
			direction="row"
			justify="flex-end"
			gap="sm"
		>
			{ actions.map( ( action ) => {
				if ( action.type === 'link' ) {
					// @wordpress/ui Button wraps base-ui's Button which
					// supports a `render` prop — pass an <a> so the
					// button is a real anchor and the href actually
					// navigates. Plain `href` on <button> is ignored.
					return (
						<Button
							key={ action.id }
							variant={ action.variant }
							size="compact"
							render={ <a href={ action.href } /> }
						>
							{ action.label }
						</Button>
					);
				}
				return (
					<Button
						key={ action.id }
						variant={ action.variant }
						size="compact"
						onClick={ () => run( action ) }
						disabled={ pending !== null }
						loading={ pending === action.id }
					>
						{ action.label }
					</Button>
				);
			} ) }
		</Stack>
	);
}

// =============================================================================
// Field collection + form layout
// =============================================================================

const LABEL_OVERRIDES = {
	// Used by the panel-layout child for the date/time row in Card 1.
	'booking-date-time': __( 'Date and time', 'woocommerce-bookings' ),
};

// Per-field visibility overrides applied during the list-field adaptation
// step. DataForm honors `isVisible` to skip the field entirely.
const VISIBILITY_OVERRIDES = {
	resource: ( item ) => !! item.product?.resource,
};

/**
 * Build the field collection consumed by DataForm.
 *
 * • Drops attendance_status when the booking is cancelled (matches CIAB).
 * • Applies readOnly to base fields so DataForm uses `render` instead of
 *   trying to render an Edit control.
 * • Appends runtime composite renderers (service info, date-time, customer
 *   details, payment breakdown, note, plus the two action button groups).
 */
// Detect the bare em-dash placeholder some field renders fall back to
// when there's no value (e.g. attendance status, payment status). On the
// list view we keep them — empty cells read as ambiguous — but in the
// card summaries they sit next to the chevron and read as noise, so we
// strip them here. Matches CIAB's behavior.
function stripEmDashRender( original ) {
	if ( typeof original !== 'function' ) return original;
	return ( props ) => {
		const out = original( props );
		if (
			out &&
			typeof out === 'object' &&
			out.type === 'span' &&
			! out.props?.className &&
			out.props?.children === '—'
		) {
			return null;
		}
		return out;
	};
}

function buildFormFields( bookingStatus ) {
	const base = buildFields()
		.filter(
			( f ) =>
				! (
					f.id === 'attendance_status' &&
					bookingStatus === 'cancelled'
				)
		)
		.map( ( f ) => {
			const adapted = {
				...f,
				type: 'text',
				// The booking note is editable so admins can update
				// the private note inline; all other fields stay
				// read-only on this detail screen.
				readOnly: f.id !== 'note',
				label: LABEL_OVERRIDES[ f.id ] ?? f.label,
				render: stripEmDashRender( f.render ),
			};
			// Same idea for customer — the list view wraps the name
			// in a mailto link, but the card summary should be plain
			// text to match CIAB.
			if ( f.id === 'customer' ) {
				adapted.render = ( { item } ) =>
					item.customer?.name || null;
			}
			if ( VISIBILITY_OVERRIDES[ f.id ] ) {
				adapted.isVisible = VISIBILITY_OVERRIDES[ f.id ];
			}
			return adapted;
		} );

	return [
		...base,
		{
			id: 'booking-service-info',
			type: 'text',
			readOnly: true,
			label: __( 'Service', 'woocommerce-bookings' ),
			render: ServiceInfoRender,
		},
		{
			id: 'booking-date-time',
			type: 'text',
			readOnly: true,
			label: __( 'Date and time', 'woocommerce-bookings' ),
			render: DateTimeRender,
		},
		{
			// Plain-text "Resource" row that always renders, even when
			// there's no resource assigned. The base `resource` field
			// from buildFields has `elements` for filtering on the list
			// view, which made DataForm hide the row when the booking's
			// resource didn't match any element. This custom field
			// side-steps that and renders an em-dash placeholder
			// otherwise.
			id: 'booking-resource',
			type: 'text',
			readOnly: true,
			label: __( 'Resource', 'woocommerce-bookings' ),
			getValue: ( { item } ) => item.product?.resource?.name || '—',
			render: ( { item } ) => item.product?.resource?.name || '—',
		},
		{
			// Per-type breakdown of person counts ("Adults: 2, Children: 1").
			// REST returns `person_counts` as [{ key, value }, ...] matching
			// CIAB's declared shape. Core only exposes a single sum
			// (`num_of_persons`); we render the breakdown read-only here,
			// mirroring `booking-resource`'s panel shape since CIAB has not
			// shipped a renderer for this field.
			id: 'booking-person-counts',
			type: 'text',
			readOnly: true,
			label: __( 'Person(s)', 'woocommerce-bookings' ),
			getValue: ( { item } ) => {
				const counts = item.person_counts;
				if ( ! counts || counts.length === 0 ) {
					return '—';
				}
				return counts
					.map( ( c ) => `${ c.key }: ${ c.value }` )
					.join( ', ' );
			},
			render: ( { item } ) => {
				const counts = item.person_counts;
				if ( ! counts || counts.length === 0 ) {
					return '—';
				}
				return counts
					.map( ( c ) => `${ c.key }: ${ c.value }` )
					.join( ', ' );
			},
		},
		{
			id: 'booking_payment_breakdown',
			type: 'text',
			readOnly: true,
			label: __( 'Payment breakdown', 'woocommerce-bookings' ),
			render: BookingPaymentBreakdown,
		},
		{
			id: 'booking_customer_details',
			type: 'text',
			readOnly: true,
			label: __( 'Customer details', 'woocommerce-bookings' ),
			render: BookingCustomerCard,
		},
		{
			id: 'note',
			type: 'text',
			// Editable — DataForm renders its built-in text input. Edits
			// land in the parent's `pendingEdits` buffer; the header Save
			// button flushes them through `bookings/update`.
			readOnly: false,
			label: __( 'Booking note', 'woocommerce-bookings' ),
		},
		{
			id: 'booking-actions-button-group',
			type: 'text',
			readOnly: true,
			label: '',
			render: BookingActionsButtons,
		},
		{
			id: 'booking-order-actions-button-group',
			type: 'text',
			readOnly: true,
			label: '',
			render: BookingOrderActionsButtons,
		},
	];
}

// Form layout — replicates the CIAB view config field-for-field.
const FORM = {
	layout: { type: 'card' },
	fields: [
		{
			id: 'details-card',
			label: __( 'Booking details', 'woocommerce-bookings' ),
			layout: {
				type: 'card',
				summary: [
					{ id: 'attendance_status', visibility: 'always' },
				],
			},
			children: [
				{
					id: 'booking-service-info',
					layout: { type: 'panel', labelPosition: 'none' },
				},
				{
					id: 'booking-date-time',
					layout: { type: 'panel', labelPosition: 'top' },
				},
				{
					id: 'booking-resource',
					layout: { type: 'panel', labelPosition: 'top' },
				},
				{
					id: 'booking-person-counts',
					layout: { type: 'panel', labelPosition: 'top' },
				},
				{
					id: 'booking-actions-button-group',
					layout: { type: 'regular', labelPosition: 'none' },
				},
			],
		},
		{
			id: 'payment-card',
			label: __( 'Payment', 'woocommerce-bookings' ),
			layout: {
				type: 'card',
				summary: [
					'total',
					{ id: 'payment_status', visibility: 'always' },
				],
			},
			children: [
				{
					id: 'booking_payment_breakdown',
					layout: { type: 'regular', labelPosition: 'none' },
				},
				{
					id: 'booking-order-actions-button-group',
					layout: { type: 'regular', labelPosition: 'none' },
				},
			],
		},
		{
			id: 'customer-card',
			label: __( 'Customer', 'woocommerce-bookings' ),
			layout: {
				type: 'card',
				isOpened: false,
				summary: [ 'customer' ],
			},
			children: [
				{
					id: 'booking_customer_details',
					layout: { type: 'regular', labelPosition: 'none' },
				},
			],
		},
		{
			id: 'note-card',
			label: __( 'Booking note', 'woocommerce-bookings' ),
			description: __(
				"This is a private note. It'll not be shared with the customer.",
				'woocommerce-bookings'
			),
			layout: {
				type: 'card',
				isOpened: false,
			},
			children: [
				{
					id: 'note',
					layout: { type: 'regular', labelPosition: 'top' },
				},
			],
		},
	],
};

// =============================================================================
// Data hook
// =============================================================================

function useBookingDetail( bookingId, refreshToken ) {
	const [ state, setState ] = useState( {
		booking: null,
		isLoading: true,
		error: null,
	} );

	useEffect( () => {
		let cancelled = false;
		setState( ( s ) => ( { ...s, isLoading: true, error: null } ) );
		apiFetch( { path: REST_BASE + 'bookings/' + bookingId } )
			.then( ( booking ) => {
				if ( cancelled ) return;
				setState( { booking, isLoading: false, error: null } );
			} )
			.catch( ( err ) => {
				if ( cancelled ) return;
				setState( ( s ) => ( {
					booking: s.booking,
					isLoading: false,
					error:
						err?.message ||
						__(
							'Failed to load booking.',
							'woocommerce-bookings'
						),
				} ) );
			} );
		return () => {
			cancelled = true;
		};
	}, [ bookingId, refreshToken ] );

	return state;
}

// =============================================================================
// Page-header actions — Save (dirty buffer flush) + kebab (booking-level
// entity actions). Mirrors CIAB's detail-page header.
// =============================================================================

function BookingHeaderActions( { booking, isDirty, isSaving, onSave } ) {
	const { pending, run } = useBookingActionRunner( booking.id );
	const { onRefresh, openReschedule: openRescheduleFromContext } = useContext(
		BookingDetailContext
	);
	const { createSuccessNotice } = useDispatch( noticesStore );
	const can = booking.can || {};
	const orderUrl = booking.order?.edit_url;
	const busy = pending !== null || isSaving;
	const [ isCancelOpen, setIsCancelOpen ] = useState( false );

	const openCancelDialog = useCallback( () => setIsCancelOpen( true ), [] );

	// AlertDialog.Root awaits this promise. Returning an `{ error }` keeps
	// the dialog open and surfaces the message inline. On success we
	// stay on the page — the booking refetches, the "Canceled" badge
	// appears in the header, and the inline action buttons hide via the
	// updated `can.*` flags. Mirrors CIAB.
	const handleConfirmCancel = useCallback( async () => {
		try {
			await apiFetch( {
				path: REST_BASE + 'bookings/cancel',
				method: 'POST',
				data: { ids: [ Number( booking.id ) ] },
			} );
			onRefresh();
			createSuccessNotice(
				__( 'Booking cancelled.', 'woocommerce-bookings' ),
				{ type: 'snackbar' }
			);
		} catch ( err ) {
			return {
				error:
					err?.message ||
					__(
						'The action could not be completed.',
						'woocommerce-bookings'
					),
			};
		}
	}, [ booking.id, onRefresh, createSuccessNotice ] );

	// Mirror CIAB: the kebab is the central, always-discoverable list of
	// entity actions. It intentionally overlaps with the inline buttons on
	// the Booking details / Payment cards. Gating uses the same `can.*`
	// flags so a single source of truth drives both surfaces. Order
	// matches CIAB's booking kebab.
	const canReschedule = isRescheduleEligible( booking );

	const controls = [
		can.cancel && {
			title: __( 'Cancel', 'woocommerce-bookings' ),
			onClick: openCancelDialog,
			isDisabled: busy,
		},
		canReschedule && {
			title: __( 'Reschedule', 'woocommerce-bookings' ),
			onClick: openRescheduleFromContext,
			isDisabled: busy,
		},
		orderUrl && {
			title: __( 'View order', 'woocommerce-bookings' ),
			onClick: () => {
				window.location.href = orderUrl;
			},
			isDisabled: busy,
		},
		!! booking.order && {
			title: __( 'Refund', 'woocommerce-bookings' ),
			onClick: () =>
				run( {
					id: 'refund',
					endpoint: null,
					notImplementedMessage: __(
						'Refund is coming soon.',
						'woocommerce-bookings'
					),
				} ),
			isDisabled: busy,
		},
		can.mark_paid && {
			title: __( 'Mark as paid', 'woocommerce-bookings' ),
			onClick: () =>
				run( {
					id: 'mark-paid',
					endpoint: 'bookings/mark-paid',
					successMessage: __(
						'Booking marked as paid.',
						'woocommerce-bookings'
					),
				} ),
			isDisabled: busy,
		},
		can.mark_attended && {
			title: __( 'Mark as attended', 'woocommerce-bookings' ),
			onClick: () =>
				run( {
					id: 'mark-attended',
					endpoint: 'bookings/mark-attended',
					successMessage: __(
						'Booking marked as attended.',
						'woocommerce-bookings'
					),
				} ),
			isDisabled: busy,
		},
		can.mark_unattended && {
			title: __( 'Mark as unattended', 'woocommerce-bookings' ),
			onClick: () =>
				run( {
					id: 'mark-unattended',
					endpoint: 'bookings/mark-unattended',
					successMessage: __(
						'Booking marked as unattended.',
						'woocommerce-bookings'
					),
				} ),
			isDisabled: busy,
		},
	].filter( Boolean );

	const customerLabel = ( booking.customer?.name || '' ).trim();
	const cancelDescription = booking.all_day
		? sprintf(
			// translators: 1: customer name, 2: product title, 3: date.
			__(
				'%1$s will no longer be able to attend "%2$s" on %3$s.',
				'woocommerce-bookings'
			),
			customerLabel || __( 'The customer', 'woocommerce-bookings' ),
			booking.product?.title || '',
			booking.start_date_only_display || ''
		)
		: sprintf(
			// translators: 1: customer name, 2: product title, 3: date, 4: time.
			__(
				'%1$s will no longer be able to attend "%2$s" on %3$s at %4$s.',
				'woocommerce-bookings'
			),
			customerLabel || __( 'The customer', 'woocommerce-bookings' ),
			booking.product?.title || '',
			booking.start_date_only_display || '',
			booking.start_time_display || ''
		);

	return (
		<Stack direction="row" align="center" gap="sm">
			<Button
				size="compact"
				disabled={ ! isDirty || isSaving }
				loading={ isSaving }
				onClick={ onSave }
			>
				{ __( 'Save', 'woocommerce-bookings' ) }
			</Button>
			{ controls.length > 0 && (
				<DropdownMenu
					icon={ moreVertical }
					label={ __( 'More actions', 'woocommerce-bookings' ) }
					controls={ controls }
					popoverProps={ { placement: 'bottom-end' } }
				/>
			) }
			<AlertDialog.Root
				open={ isCancelOpen }
				onOpenChange={ setIsCancelOpen }
				onConfirm={ handleConfirmCancel }
			>
				<AlertDialog.Portal>
					<AlertDialog.Popup
						title={ __(
							'Cancel this booking',
							'woocommerce-bookings'
						) }
						description={ cancelDescription }
						confirmButtonText={ __(
							'Yes, cancel booking',
							'woocommerce-bookings'
						) }
						cancelButtonText={ __(
							'No, keep it',
							'woocommerce-bookings'
						) }
					/>
				</AlertDialog.Portal>
			</AlertDialog.Root>
		</Stack>
	);
}

// =============================================================================
// Main component
// =============================================================================

export default function BookingDetail( { bookingId } ) {
	const [ refreshToken, setRefreshToken ] = useState( 0 );
	const [ detailRouter ] = useState( createDetailRouter );
	const { booking, isLoading, error } = useBookingDetail(
		bookingId,
		refreshToken
	);

	const onRefresh = useCallback(
		() => setRefreshToken( ( n ) => n + 1 ),
		[]
	);
	const [ isRescheduleOpen, setIsRescheduleOpen ] = useState( false );
	const openReschedule = useCallback(
		() => setIsRescheduleOpen( true ),
		[]
	);
	const closeReschedule = useCallback(
		() => setIsRescheduleOpen( false ),
		[]
	);
	const contextValue = useMemo(
		() => ( { onRefresh, openReschedule } ),
		[ onRefresh, openReschedule ]
	);

	const formFields = useMemo(
		() => buildFormFields( booking?.status ),
		[ booking?.status ]
	);

	// Filter optional rows out of the details card when they have no data
	// to display. `booking-resource` and `booking-person-counts` are both
	// product-level features that may not apply to a given booking — when
	// they don't, hide the row entirely rather than show a placeholder.
	const formForBooking = useMemo( () => {
		if ( ! booking ) return FORM;
		const hasResource = !! booking.product?.resource?.name;
		const hasPersonCounts =
			Array.isArray( booking.person_counts ) &&
			booking.person_counts.length > 0;
		if ( hasResource && hasPersonCounts ) return FORM;
		return {
			...FORM,
			fields: FORM.fields.map( ( card ) => {
				if ( card.id !== 'details-card' ) return card;
				return {
					...card,
					children: card.children.filter( ( child ) => {
						if ( child.id === 'booking-resource' ) {
							return hasResource;
						}
						if ( child.id === 'booking-person-counts' ) {
							return hasPersonCounts;
						}
						return true;
					} ),
				};
			} ),
		};
	}, [ booking?.product?.resource?.name, booking?.person_counts ] );

	// Dirty buffer for editable fields. Edits don't hit the network
	// until the user presses Save in the header — see `saveEdits`.
	// `pendingEdits` is a partial of the booking shape; the form is
	// rendered with `{ ...booking, ...pendingEdits }` so unsaved
	// changes survive background re-fetches and the textarea stays in
	// sync with what the user typed.
	const [ pendingEdits, setPendingEdits ] = useState( {} );
	const [ isSaving, setIsSaving ] = useState( false );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	useEffect( () => {
		// Reset the buffer when navigating to a different booking.
		setPendingEdits( {} );
	}, [ booking?.id ] );

	const handleFormChange = useCallback(
		( updater ) => {
			const merged = { ...( booking || {} ), ...pendingEdits };
			const next =
				typeof updater === 'function' ? updater( merged ) : updater;
			if ( ! next ) return;
			// Pick out only the fields that actually changed vs the
			// booking source of truth.
			const diff = {};
			if ( next.note !== undefined && next.note !== ( booking?.note ?? '' ) ) {
				diff.note = next.note;
			}
			setPendingEdits( ( prev ) => ( { ...prev, ...diff } ) );
		},
		[ booking, pendingEdits ]
	);

	const dataForForm = useMemo( () => {
		if ( ! booking ) return null;
		return Object.keys( pendingEdits ).length === 0
			? booking
			: { ...booking, ...pendingEdits };
	}, [ booking, pendingEdits ] );

	const isDirty = Object.keys( pendingEdits ).length > 0;

	const saveEdits = useCallback( () => {
		if ( ! isDirty || isSaving ) return;
		setIsSaving( true );
		apiFetch( {
			path: REST_BASE + 'bookings/update',
			method: 'POST',
			data: { id: bookingId, fields: pendingEdits },
		} )
			.then( () => {
				setPendingEdits( {} );
				createSuccessNotice(
					__( 'Booking updated.', 'woocommerce-bookings' ),
					{ type: 'snackbar' }
				);
				onRefresh();
			} )
			.catch( ( err ) => {
				createErrorNotice(
					err?.message ||
						__(
							'Failed to update booking.',
							'woocommerce-bookings'
						),
					{ type: 'snackbar' }
				);
			} )
			.finally( () => {
				setIsSaving( false );
			} );
	}, [
		bookingId,
		pendingEdits,
		isDirty,
		isSaving,
		onRefresh,
		createSuccessNotice,
		createErrorNotice,
	] );

	if ( isLoading && ! booking ) {
		return (
			<div className="wc-bookings-dv-detail wc-bookings-dv-detail--loading">
				<Spinner />
			</div>
		);
	}

	if ( error && ! booking ) {
		return (
			<div className="wc-bookings-dv-detail">
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
				<p>
					<a href={ LIST_URL }>
						{ __(
							'← Back to All Bookings',
							'woocommerce-bookings'
						) }
					</a>
				</p>
			</div>
		);
	}

	if ( ! booking ) return null;

	const content = (
		<BookingDetailContext.Provider value={ contextValue }>
			<Page
				subTitle={ getSubtitle( booking ) }
				showSidebarToggle={ false }
				hasPadding
				breadcrumbs={
					<BookingBreadcrumbs bookingId={ booking.id } />
				}
				badges={ <HeaderBadges booking={ booking } /> }
				actions={
					<BookingHeaderActions
						booking={ booking }
						isDirty={ isDirty }
						isSaving={ isSaving }
						onSave={ saveEdits }
					/>
				}
			>
				<div className="wc-bookings-dv-detail">
					<DataForm
						data={ dataForForm }
						fields={ formFields }
						form={ formForBooking }
						onChange={ handleFormChange }
					/>
				</div>
			</Page>
			<RescheduleBookingDialog
				booking={ booking }
				isOpen={ isRescheduleOpen }
				onClose={ closeReschedule }
				onSuccess={ onRefresh }
			/>
		</BookingDetailContext.Provider>
	);

	return (
		<RouterContentContext.Provider value={ content }>
			<RouterProvider router={ detailRouter } />
		</RouterContentContext.Provider>
	);
}
