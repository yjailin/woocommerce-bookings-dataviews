/**
 * Reschedule booking modal — body + DataViews action descriptor.
 *
 * Ported from CIAB's `actions/reschedule-booking.tsx`. CIAB-specific
 * substitutions:
 *   • @ciab/dataviews `Action` typed object → plain object compatible
 *     with @wordpress/dataviews ActionModal shape.
 *   • @automattic/admin-toolkit `unlock(privateApis)` DateCalendar →
 *     stable `DatePicker` from @wordpress/components.
 *   • core-data `editEntityRecord`/`saveEditedEntityRecord` →
 *     `POST <REST_BASE>bookings/{id}/reschedule`.
 *   • @automattic/design-system Stack/SelectControl → `@wordpress/ui`
 *     Stack + `@wordpress/components` SelectControl.
 *   • `useEntityRecord(product)` + `useEntityRecordsWithPermissions`
 *     for resources → both are inlined onto the booking detail response
 *     (`product.duration`, `product.duration_unit`, `product.resources`).
 *   • Telemetry (`useTrackedModal`) skipped.
 *
 * Exports:
 *   • RescheduleBookingForm   — body (assumes booking is detail-shape).
 *   • RescheduleBookingLoader — fetches detail by id then renders form.
 *   • RescheduleBookingDialog — Modal wrapper used by the detail page.
 *   • buildRescheduleAction   — DataViews action descriptor (RenderModal).
 *   • isRescheduleEligible    — exported so the detail-page kebab can
 *     gate visibility identically.
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import {
	__experimentalText as Text,
	__experimentalHeading as Heading,
	Spinner,
	SelectControl,
	Modal,
	privateApis as componentsPrivateApis,
} from '@wordpress/components';
import { Button, Stack } from '@wordpress/ui';

import {
	getDayKey,
	calculateEndDate,
	buildSlotDateTime,
	formatSlotKey,
	formatDateString,
	formatTimeString,
} from './utils/dates';
import { unlock } from './utils/private-apis';
import { useBookingScheduleCalendar } from './hooks/use-booking-schedule-calendar';
import { useScrollFade } from './hooks/use-scroll-fade';

// Same pattern CIAB uses: pull `DateCalendar` (single-day picker) and
// `DateRangeCalendar` (start+end day picker) out of @wordpress/components'
// privateApis. We switch between them based on `product.requires_date_range`,
// which the REST shape derives from `WC_Product_Booking::is_range_picker_enabled()`.
// The public `DatePicker` is the legacy component and doesn't share CIAB's
// SCSS contract (different DOM, different class names, smaller day buttons).
// See ./utils/private-apis.js for the impersonation rationale.
const { DateCalendar, DateRangeCalendar } = unlock( componentsPrivateApis );

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl || '';

export function isRescheduleEligible( booking ) {
	const status = booking?.status;
	return (
		status !== 'cancelled' &&
		status !== 'complete' &&
		status !== 'failed' &&
		status !== 'in-cart'
	);
}

/**
 * Body of the modal — calendar + slot picker + actions. Pure function
 * of its props; the parent owns the modal shell.
 *
 * `booking` must include the detail-shape fields:
 *   start, end           — Unix seconds
 *   product_id, resource_id
 *   product.duration, product.duration_unit, product.resources
 */
export function RescheduleBookingForm( { booking, onClose, onSuccess } ) {
	const [ isBusy, setIsBusy ] = useState( false );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const product = booking?.product || {};
	const productResources = useMemo( () => {
		const list = Array.isArray( product.resources )
			? product.resources
			: [];
		return list.map( ( r ) => ( {
			label: r.name,
			value: String( r.id ),
		} ) );
	}, [ product.resources ] );

	const today = useMemo( () => new Date(), [] );
	const bookingDate = useMemo(
		() => new Date( Number( booking.start ) * 1000 ),
		[ booking.start ]
	);
	const bookingEndDate = useMemo(
		() => new Date( Number( booking.end ) * 1000 ),
		[ booking.end ]
	);

	// Switch between single-day-+-time-slot mode (default) and date-range
	// mode (day/month-based bookings whose product opts into the range
	// picker). Drives both the calendar (DateCalendar vs DateRangeCalendar)
	// and the slot column (hidden in range mode — there are no per-day
	// time slots for whole-day bookings). The server-side gate is
	// `WC_Product_Booking::is_range_picker_enabled()` — see
	// `shape_booking_detail` in the REST controller.
	const requiresRange = !! product.requires_date_range;

	// Range mode tracks a {from, to} pair instead of a single selected
	// date + slot. Seed it with the booking's current span so the
	// submit button is immediately actionable (the user can confirm a
	// no-change reschedule, or extend/shift the range from this baseline).
	// `DateRangeCalendar` uses `to: undefined` mid-selection (after the
	// user clicks `from` but before clicking `to`), so we honor undefined
	// downstream instead of forcing a fallback.
	const [ selectedRange, setSelectedRange ] = useState( () => ( {
		from: bookingDate,
		to: bookingEndDate,
	} ) );

	const {
		visibleMonth,
		currentMonthStart,
		resourceId,
		setResourceId,
		selectedDate,
		isDateDisabled,
		handleDateSelect,
		handleMonthChange,
		selectedSlot,
		setSelectedSlot,
		availableSlots,
		isLoadingSlots,
		formatSlotTime,
		updateAvailabilityAfterReschedule,
	} = useBookingScheduleCalendar( {
		productId: Number( booking.product_id || product.id ),
		// Native <select> with value="" silently shows the first option's
		// label, which would make the dropdown lie about the React state
		// when the booking has no resource yet. Initialise to the first
		// resource so the visual default matches what gets filtered.
		resourceId:
			booking.resource_id ||
			( productResources.length > 0
				? Number( productResources[ 0 ].value )
				: null ),
		bookingDate,
	} );

	const formatSlotTimeRange = useCallback(
		( slot ) => {
			const startLabel = formatSlotTime( slot );
			if ( ! selectedDate ) {
				return startLabel;
			}
			const slotStart = buildSlotDateTime( selectedDate, slot );
			const slotEnd = calculateEndDate(
				slotStart,
				product.booking_duration || 1,
				product.booking_duration_unit || 'minute'
			);
			return `${ startLabel } – ${ formatTimeString( slotEnd ) }`;
		},
		[
			formatSlotTime,
			selectedDate,
			product.booking_duration,
			product.booking_duration_unit,
		]
	);

	const { slotsFadeRef, slotsListRef } = useScrollFade( availableSlots );

	useEffect( () => {
		if (
			! selectedSlot ||
			! slotsListRef.current ||
			availableSlots.length === 0
		) {
			return;
		}
		const index = availableSlots.indexOf( selectedSlot );
		if ( index < 0 ) return;
		const button = slotsListRef.current.children[ index ];
		if ( button instanceof HTMLElement ) {
			button.scrollIntoView( { block: 'nearest' } );
		}
	}, [ availableSlots, selectedSlot, slotsListRef ] );

	const onReschedule = useCallback( async () => {
		let start;
		let end;
		let newDayKey;
		let newSlotKey;
		let newAnchorDate;

		if ( requiresRange ) {
			// Range mode: the picked from/to dates are whole days, so
			// start at 00:00 of the from-day and end at 00:00 of the
			// day *after* the to-day. The half-open interval matches
			// the existing day-based bookings (e.g. a single-day "1-day"
			// booking spans midnight to next midnight) so the rendered
			// duration in the UI stays consistent.
			if ( ! selectedRange?.from || ! selectedRange?.to ) {
				void createErrorNotice(
					__(
						'Please select a start and end date.',
						'woocommerce-bookings'
					),
					{ type: 'snackbar' }
				);
				return;
			}
			const fromDay = new Date( selectedRange.from );
			fromDay.setHours( 0, 0, 0, 0 );
			const endExclusive = new Date( selectedRange.to );
			endExclusive.setHours( 0, 0, 0, 0 );
			endExclusive.setDate( endExclusive.getDate() + 1 );
			start = Math.floor( fromDay.getTime() / 1000 );
			end = Math.floor( endExclusive.getTime() / 1000 );
			newAnchorDate = fromDay;
			newDayKey = getDayKey( fromDay );
			newSlotKey = formatSlotKey( fromDay );
		} else {
			if ( ! selectedSlot || ! selectedDate ) {
				void createErrorNotice(
					__( 'Please select a time slot.', 'woocommerce-bookings' ),
					{ type: 'snackbar' }
				);
				return;
			}
			const slotDate = buildSlotDateTime(
				selectedDate,
				selectedSlot
			);
			start = Math.floor( slotDate.getTime() / 1000 );
			end = Math.floor(
				calculateEndDate(
					slotDate,
					product.booking_duration || 1,
					product.booking_duration_unit || 'minute'
				).getTime() / 1000
			);
			newAnchorDate = selectedDate;
			newDayKey = getDayKey( selectedDate );
			newSlotKey = selectedSlot;
		}

		setIsBusy( true );

		const oldDayKey = getDayKey( bookingDate );
		const oldSlotTime = formatSlotKey( bookingDate );

		const payload = { start, end };
		if ( resourceId && resourceId > 0 ) {
			payload.resource_id = resourceId;
		}

		try {
			await apiFetch( {
				path: `${ REST_BASE }bookings/${ booking.id }/reschedule`,
				method: 'POST',
				data: payload,
			} );

			updateAvailabilityAfterReschedule(
				oldDayKey,
				oldSlotTime,
				newDayKey,
				newSlotKey,
				bookingDate,
				newAnchorDate,
				Number( booking.product_id || product.id ),
				booking.resource_id || null
			);

			void createSuccessNotice(
				__(
					'Booking rescheduled successfully.',
					'woocommerce-bookings'
				),
				{ type: 'snackbar' }
			);
			onSuccess?.();
			onClose?.();
		} catch ( err ) {
			const errorMessage =
				err?.message ||
				__(
					'An error occurred while rescheduling the booking.',
					'woocommerce-bookings'
				);
			void createErrorNotice( errorMessage, { type: 'snackbar' } );
		} finally {
			setIsBusy( false );
		}
	}, [
		requiresRange,
		selectedRange,
		selectedSlot,
		selectedDate,
		bookingDate,
		booking.id,
		booking.product_id,
		booking.resource_id,
		product.id,
		product.booking_duration,
		product.booking_duration_unit,
		resourceId,
		createErrorNotice,
		createSuccessNotice,
		updateAvailabilityAfterReschedule,
		onSuccess,
		onClose,
	] );

	return (
		<Stack direction="column" gap="lg">
			<Stack direction="column" gap="xs">
				<Heading level={ 3 }>
					{ __( 'Reschedule booking', 'woocommerce-bookings' ) }
				</Heading>
				<Text variant="muted">
					{ requiresRange
						? sprintf(
								/* translators: 1: service / product name, 2: booking start date, 3: booking end date */
								__(
									'%1$s is currently scheduled from %2$s to %3$s. Select a new date range to reschedule this booking.',
									'woocommerce-bookings'
								),
								product.title || '',
								formatDateString( bookingDate ),
								formatDateString( bookingEndDate )
						  )
						: sprintf(
								/* translators: 1: service / product name, 2: booking date, 3: booking start time, 4: booking end time */
								__(
									'%1$s is currently scheduled for: %2$s · %3$s - %4$s. Select a new time to reschedule this booking.',
									'woocommerce-bookings'
								),
								product.title || '',
								formatDateString( bookingDate ),
								formatTimeString( bookingDate ),
								formatTimeString( bookingEndDate )
						  ) }
				</Text>
			</Stack>

			{ productResources.length > 0 && (
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Resource', 'woocommerce-bookings' ) }
					value={ resourceId ? String( resourceId ) : '' }
					options={ productResources }
					onChange={ ( value ) => setResourceId( Number( value ) ) }
					disabled={ isBusy }
				/>
			) }

			<div
				className={
					requiresRange
						? 'woocommerce-bookings-schedule-form woocommerce-bookings-schedule-form--range'
						: 'woocommerce-bookings-schedule-form'
				}
			>
				<div className="woocommerce-bookings-schedule-form__calendar">
					{ requiresRange ? (
						<DateRangeCalendar
							startMonth={ currentMonthStart }
							selected={ selectedRange }
							onSelect={ ( range ) =>
								setSelectedRange( range )
							}
							month={ visibleMonth }
							onMonthChange={ handleMonthChange }
							disabled={ isDateDisabled }
							excludeDisabled
						/>
					) : (
						<DateCalendar
							startMonth={ currentMonthStart }
							defaultSelected={ today }
							selected={ selectedDate }
							onSelect={ ( _selected, triggerDate ) =>
								handleDateSelect( triggerDate )
							}
							month={ visibleMonth }
							onMonthChange={ handleMonthChange }
							disabled={ isDateDisabled }
						/>
					) }
				</div>
				{ /* Slots column only makes sense for time-of-day pickers.
				     Day/month-based bookings (requiresRange) don't have
				     per-day time slots — the whole day is booked. Skip
				     the divider + slots entirely in that case so the
				     calendar can occupy the full modal width. */ }
				{ ! requiresRange && (
					<>
						<div
							className="woocommerce-bookings-schedule-form__divider"
							aria-hidden="true"
						/>
						<div className="woocommerce-bookings-schedule-form__slots">
							{ isLoadingSlots && (
								<div className="woocommerce-bookings-schedule-form__slots-loading">
									<Spinner />
								</div>
							) }
							{ ! isLoadingSlots &&
								availableSlots.length === 0 && (
									<Text variant="muted">
										{ __(
											'No available time slots for this date.',
											'woocommerce-bookings'
										) }
									</Text>
								) }
							{ ! isLoadingSlots &&
								availableSlots.length > 0 && (
									<div
										className="woocommerce-bookings-schedule-form__slots-fade"
										ref={ slotsFadeRef }
									>
										<div
											className="woocommerce-bookings-schedule-form__slots-list"
											ref={ slotsListRef }
										>
											{ availableSlots.map( ( slot ) => (
												<Button
													key={ slot }
													size="default"
													variant="outline"
													tone={
														selectedSlot === slot
															? 'brand'
															: 'neutral'
													}
													onClick={ () =>
														setSelectedSlot( slot )
													}
													disabled={ isBusy }
													className="woocommerce-bookings-schedule-form__slots-list__button"
												>
													{ formatSlotTimeRange( slot ) }
												</Button>
											) ) }
										</div>
									</div>
								) }
						</div>
					</>
				) }
			</div>

			<Stack direction="row" justify="flex-end" gap="sm">
				<Button
					variant="minimal"
					onClick={ () => onClose?.() }
					disabled={ isBusy }
				>
					{ __( 'Cancel', 'woocommerce-bookings' ) }
				</Button>
				<Button
					variant="solid"
					onClick={ onReschedule }
					loading={ isBusy }
					loadingAnnouncement={ __(
						'Rescheduling booking',
						'woocommerce-bookings'
					) }
					disabled={
						isBusy ||
						( requiresRange
							? ! selectedRange?.from || ! selectedRange?.to
							: ! selectedSlot )
					}
				>
					{ __( 'Reschedule', 'woocommerce-bookings' ) }
				</Button>
			</Stack>
		</Stack>
	);
}

/**
 * Loader: if we already have detail-shape booking data, render the
 * form. Otherwise fetch the detail by id and show a spinner first. Used
 * inside both DataViews' RenderModal and our own <Modal> shell.
 */
export function RescheduleBookingLoader( {
	booking,
	bookingId,
	onClose,
	onSuccess,
} ) {
	const hasDetail = booking && booking.start !== undefined;
	const [ resolved, setResolved ] = useState( hasDetail ? booking : null );
	const [ isLoading, setIsLoading ] = useState( ! hasDetail );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		if ( hasDetail ) {
			setResolved( booking );
			return undefined;
		}
		const id = bookingId || booking?.id;
		if ( ! id ) return undefined;
		let cancelled = false;
		setIsLoading( true );
		setError( null );
		apiFetch( { path: `${ REST_BASE }bookings/${ id }` } )
			.then( ( res ) => {
				if ( cancelled ) return;
				setResolved( res );
				setIsLoading( false );
			} )
			.catch( ( err ) => {
				if ( cancelled ) return;
				setError(
					err?.message ||
						__(
							'Failed to load booking.',
							'woocommerce-bookings'
						)
				);
				setIsLoading( false );
			} );
		return () => {
			cancelled = true;
		};
	}, [ hasDetail, booking, bookingId ] );

	if ( isLoading ) {
		return (
			<div className="wc-bookings-dv-reschedule-modal__loading">
				<Spinner />
			</div>
		);
	}
	if ( error ) {
		return <Text variant="muted">{ error }</Text>;
	}
	if ( ! resolved ) return null;
	return (
		<RescheduleBookingForm
			booking={ resolved }
			onClose={ onClose }
			onSuccess={ onSuccess }
		/>
	);
}

/**
 * Detail-page entry: <Modal> wraps the loader. We manage open/close
 * locally; on success the parent's `onSuccess` triggers a refetch of
 * the booking detail so all surfaces reflect the new time.
 */
export function RescheduleBookingDialog( {
	booking,
	bookingId,
	isOpen,
	onClose,
	onSuccess,
} ) {
	if ( ! isOpen ) return null;
	return (
		<Modal
			__experimentalHideHeader
			size="large"
			onRequestClose={ onClose }
			className="wc-bookings-dv-reschedule-modal"
		>
			<RescheduleBookingLoader
				booking={ booking }
				bookingId={ bookingId }
				onClose={ onClose }
				onSuccess={ onSuccess }
			/>
		</Modal>
	);
}

/**
 * DataViews action descriptor (RenderModal-style — DataViews owns the
 * modal shell). The list items lack detail-shape fields, so the loader
 * pulls them on open.
 */
export function buildRescheduleAction( { onSuccess } ) {
	return {
		id: 'reschedule-booking',
		label: __( 'Reschedule', 'woocommerce-bookings' ),
		isDestructive: false,
		supportsBulk: false,
		hideModalHeader: true,
		modalSize: 'large',
		isEligible: isRescheduleEligible,
		RenderModal: ( { items, closeModal } ) => {
			const item = items?.[ 0 ];
			return (
				<RescheduleBookingLoader
					booking={ null }
					bookingId={ item?.id }
					onClose={ closeModal }
					onSuccess={ onSuccess }
				/>
			);
		},
	};
}
