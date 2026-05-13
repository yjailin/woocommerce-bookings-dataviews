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
 * Skipped vs. CIAB:
 *   • `booking_location` — WC Bookings core has no booking-level location.
 *   • `useTrack` / `useTrackedModal` — telemetry, not needed here.
 *   • Editing — `note` is rendered read-only; save flow needs core-data
 *     entity registration (separate Phase 1+2 work).
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Spinner, Notice } from '@wordpress/components';
import { Page, Breadcrumbs } from '@wordpress/admin-ui';
import { Badge, Button, Stack } from '@wordpress/ui';
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router';
import { DataForm } from '@wordpress/dataviews';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { Icon, box } from '@wordpress/icons';
import { buildFields } from './fields';

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl || '';
const LIST_URL = window.WC_BOOKINGS_DATAVIEWS_DATA?.listUrl || '';

// =============================================================================
// Context — used by inline card action buttons to trigger a refetch on the
// parent after a successful action. Avoids prop-drilling through DataForm.
// =============================================================================

const BookingDetailContext = createContext( { onRefresh: () => {} } );

// =============================================================================
// Header helpers
// =============================================================================

const PAYMENT_BADGE = {
	unpaid: { intent: 'low', label: __( 'Unpaid', 'woocommerce-bookings' ) },
	'pending-confirmation': {
		intent: 'low',
		label: __( 'Unpaid', 'woocommerce-bookings' ),
	},
	confirmed: { intent: 'low', label: __( 'Unpaid', 'woocommerce-bookings' ) },
	paid: { intent: 'none', label: __( 'Paid', 'woocommerce-bookings' ) },
	complete: { intent: 'none', label: __( 'Paid', 'woocommerce-bookings' ) },
	refunded: { intent: 'none', label: __( 'Refunded', 'woocommerce-bookings' ) },
};

const ATTENDANCE_FIELD = buildFields().find(
	( f ) => f.id === 'attendance_status'
);

function HeaderBadges( { booking } ) {
	const isCancelled = booking.status === 'cancelled';
	const pBadge = PAYMENT_BADGE[ booking.status ];

	// Only render the attendance field when it will produce a real Badge.
	// The field's own `render` falls back to a "—" span when the booking
	// has no recorded attendance and isn't in the past — we don't want
	// that placeholder in the header.
	const hasAttendance =
		booking.attendance_status === 'attended' ||
		booking.attendance_status === 'unattended' ||
		booking.is_past;

	return (
		<>
			{ isCancelled ? (
				<Badge intent="informational">
					{ __( 'Canceled', 'woocommerce-bookings' ) }
				</Badge>
			) : (
				hasAttendance &&
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
						__( 'Booking #%d', 'woocommerce-bookings' ),
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
	if ( ! booking.start_date_only_display || ! booking.start_time_display ) {
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
 * BookingPaymentBreakdown — line items + total.
 * CIAB's full implementation reads `order.line_items`; we don't expose those
 * separately yet, so we render a single service line + total row from the
 * booking + order totals we already ship.
 */
function BookingPaymentBreakdown( { item } ) {
	const serviceName = item.product?.title || __( 'Service', 'woocommerce-bookings' );
	const lineTotal = item.total_display || '—';
	const orderTotal = item.order?.total_display || lineTotal;
	return (
		<div className="wc-bookings-dv-detail__payment-breakdown">
			<div className="wc-bookings-dv-detail__payment-row">
				<span>{ serviceName }</span>
				<span>{ lineTotal }</span>
			</div>
			<div className="wc-bookings-dv-detail__payment-row wc-bookings-dv-detail__payment-row--total">
				<span>{ __( 'Total', 'woocommerce-bookings' ) }</span>
				<span>{ orderTotal }</span>
			</div>
		</div>
	);
}

/**
 * BookingCustomerDetails — name + email + phone composite.
 * Replaces CIAB's `booking_customer_details` field.
 */
function BookingCustomerDetails( { item } ) {
	const c = item.customer || {};
	if ( ! c.name && ! c.email && ! c.phone ) {
		return <span>—</span>;
	}
	return (
		<div className="wc-bookings-dv-detail__customer-details">
			{ c.name && (
				<div className="wc-bookings-dv-detail__customer-details-row">
					{ c.name }
				</div>
			) }
			{ c.email && (
				<div className="wc-bookings-dv-detail__customer-details-row">
					<a href={ `mailto:${ c.email }` }>{ c.email }</a>
				</div>
			) }
			{ c.phone && (
				<div className="wc-bookings-dv-detail__customer-details-row">
					{ c.phone }
				</div>
			) }
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
	const can = item.can || {};
	const canReschedule =
		item.status !== 'cancelled' && item.status !== 'complete';

	const actions = [
		canReschedule && {
			id: 'reschedule',
			label: __( 'Reschedule', 'woocommerce-bookings' ),
			variant: 'minimal',
			endpoint: null,
			notImplementedMessage: __(
				"Reschedule isn't wired up in this plugin yet.",
				'woocommerce-bookings'
			),
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
		<Stack direction="row" justify="flex-end" gap="sm">
			{ actions.map( ( action ) => (
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
				"Refund isn't wired up in this plugin yet.",
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
		<Stack direction="row" justify="flex-end" gap="sm">
			{ actions.map( ( action ) => {
				if ( action.type === 'link' ) {
					return (
						<Button
							key={ action.id }
							variant={ action.variant }
							size="compact"
							href={ action.href }
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
	attendance_status: ( item ) =>
		!! item.attendance_status || !! item.is_past,
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
				readOnly: true,
				label: LABEL_OVERRIDES[ f.id ] ?? f.label,
			};
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
			render: BookingCustomerDetails,
		},
		{
			id: 'note',
			type: 'text',
			readOnly: true,
			label: __( 'Note', 'woocommerce-bookings' ),
			render: NoteRender,
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
					id: 'resource',
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
					{ id: 'status', visibility: 'always' },
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
					layout: { type: 'regular', labelPosition: 'none' },
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
// Page-header Cancel (the only top-level entity action for now)
// =============================================================================

function PageHeaderActions( { booking } ) {
	const { pending, run } = useBookingActionRunner( booking.id );
	const can = booking.can || {};
	if ( ! can.cancel ) return null;

	return (
		<Button
			size="compact"
			variant="outline"
			loading={ pending === 'cancel' }
			disabled={ pending !== null }
			onClick={ () => {
				// eslint-disable-next-line no-alert -- intentional confirm for destructive action.
				if (
					! window.confirm(
						__(
							'Cancel this booking? This cannot be undone.',
							'woocommerce-bookings'
						)
					)
				) {
					return;
				}
				run( {
					id: 'cancel',
					endpoint: 'bookings/cancel',
					redirectTo: LIST_URL,
				} );
			} }
		>
			{ __( 'Cancel booking', 'woocommerce-bookings' ) }
		</Button>
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
	const contextValue = useMemo( () => ( { onRefresh } ), [ onRefresh ] );

	const formFields = useMemo(
		() => buildFormFields( booking?.status ),
		[ booking?.status ]
	);

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
				actions={ <PageHeaderActions booking={ booking } /> }
			>
				<div className="wc-bookings-dv-detail">
					<DataForm
						data={ booking }
						fields={ formFields }
						form={ FORM }
						onChange={ () => {} }
					/>
				</div>
			</Page>
		</BookingDetailContext.Provider>
	);

	return (
		<RouterContentContext.Provider value={ content }>
			<RouterProvider router={ detailRouter } />
		</RouterContentContext.Provider>
	);
}
