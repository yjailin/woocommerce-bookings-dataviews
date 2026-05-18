/**
 * useBookingScheduleCalendar — orchestrates calendar selection +
 * available-slots for the reschedule modal. Ported from CIAB's
 * `hooks/use-booking-schedule-calendar.ts`.
 *
 * The booking's own current date/slot is always selectable so the user
 * can revert: the day is force-enabled, and the occupied slot is
 * injected back into the slot list for that day (the availability API
 * otherwise reports it as fully booked because the row consumes itself).
 */

import {
	useState,
	useEffect,
	useCallback,
	useMemo,
	useRef,
} from '@wordpress/element';
import {
	getMonthKey,
	getDayKey,
	formatSlotKey,
	formatTimeString,
} from '../utils/dates';
import { useBookingAvailability } from './use-booking-availability';

export function useBookingScheduleCalendar( {
	productId,
	resourceId: initialResourceId,
	bookingDate,
} ) {
	const today = useMemo( () => new Date(), [] );
	const todayStart = useMemo( () => {
		const d = new Date();
		d.setHours( 0, 0, 0, 0 );
		return d;
	}, [] );
	const currentMonthStart = useMemo(
		() => new Date( today.getFullYear(), today.getMonth(), 1 ),
		[ today ]
	);

	const [ visibleMonth, setVisibleMonth ] = useState(
		() =>
			new Date( bookingDate.getFullYear(), bookingDate.getMonth(), 1 )
	);

	const [ resourceId, setResourceId ] = useState(
		initialResourceId || null
	);

	const {
		availabilityByMonth,
		loadingMonths,
		updateAvailabilityAfterReschedule,
	} = useBookingAvailability( productId, resourceId, visibleMonth );

	const bookingSlotKey = useMemo(
		() => formatSlotKey( bookingDate ),
		[ bookingDate ]
	);
	const bookingDayKey = useMemo(
		() => getDayKey( bookingDate ),
		[ bookingDate ]
	);

	const [ selectedDate, setSelectedDate ] = useState( bookingDate );
	const [ availableSlots, setAvailableSlots ] = useState( [] );
	const [ selectedSlot, setSelectedSlot ] = useState( null );
	const [ isLoadingSlots, setIsLoadingSlots ] = useState( false );
	const hasAutoSelectedSlot = useRef( false );

	useEffect( () => {
		if ( ! selectedDate ) {
			setAvailableSlots( [] );
			return;
		}

		const selectedMonthKey = getMonthKey( selectedDate );
		const selectedMonthAvailability =
			availabilityByMonth[ selectedMonthKey ];
		const isSelectedMonthLoading = !! loadingMonths[ selectedMonthKey ];

		setIsLoadingSlots( isSelectedMonthLoading );
		if (
			isSelectedMonthLoading ||
			! selectedMonthAvailability ||
			Object.keys( selectedMonthAvailability ).length === 0
		) {
			if ( ! isSelectedMonthLoading ) {
				setAvailableSlots( [] );
			}
			return;
		}

		const dayKey = getDayKey( selectedDate );
		const isBookingDay = dayKey === bookingDayKey;

		const slots = [];
		if ( selectedMonthAvailability[ dayKey ] ) {
			const daySlots = selectedMonthAvailability[ dayKey ];
			Object.keys( daySlots )
				.filter( ( time ) => daySlots[ time ] > 0 )
				.sort()
				.forEach( ( time ) => {
					slots.push( time );
				} );
		}

		// The booking's own slot reads as occupied via the availability
		// API. Inject it back so users can confirm or revert to it.
		if ( isBookingDay && ! slots.includes( bookingSlotKey ) ) {
			slots.push( bookingSlotKey );
			slots.sort();
		}

		setAvailableSlots( slots );

		// Slot selection rules:
		//   1. First time this effect resolves on the booking's own day,
		//      auto-select the booking's existing slot so submit is
		//      immediately actionable. Latch via the ref so this only
		//      happens once per modal lifetime.
		//   2. If the user navigates to a *different* day, clear the slot
		//      — the prior pick belongs to the prior day.
		//   3. Otherwise (on booking day after auto-select, or after the
		//      user has explicitly picked one), preserve the current
		//      selection. Earlier versions cleared in this branch too,
		//      which nuked the auto-selected slot on every subsequent
		//      effect re-run (e.g. when availability re-fetched after a
		//      resource change), leaving submit perma-disabled until the
		//      user clicked a slot.
		if ( isBookingDay && ! hasAutoSelectedSlot.current ) {
			setSelectedSlot( bookingSlotKey );
			hasAutoSelectedSlot.current = true;
		} else if ( ! isBookingDay ) {
			setSelectedSlot( null );
		}
	}, [
		selectedDate,
		availabilityByMonth,
		loadingMonths,
		bookingDayKey,
		bookingSlotKey,
	] );

	const isDateDisabled = useCallback(
		( date ) => {
			const dateOnly = new Date( date );
			dateOnly.setHours( 0, 0, 0, 0 );
			if ( dateOnly <= todayStart ) {
				return true;
			}
			if ( getDayKey( date ) === bookingDayKey ) {
				return false;
			}
			const monthKey = getMonthKey( date );
			const monthAvailability = availabilityByMonth[ monthKey ];
			if ( monthAvailability === undefined ) {
				return true;
			}
			if ( Object.keys( monthAvailability ).length === 0 ) {
				return true;
			}
			const dayKey = getDayKey( date );
			const daySlots = monthAvailability[ dayKey ];
			if ( ! daySlots ) {
				return true;
			}
			return ! Object.values( daySlots ).some( ( a ) => a > 0 );
		},
		[ availabilityByMonth, todayStart, bookingDayKey ]
	);

	const formatSlotTime = useCallback(
		( time ) => {
			if ( ! selectedDate ) {
				return time;
			}
			const [ hours, minutes ] = time.split( ':' );
			// API slot keys are already in store-local clock time but stored
			// as UTC-anchored timestamps (CIAB's note in the original hook
			// — keeping UTC avoids tz double-shift in dateI18n).
			const date = new Date(
				Date.UTC(
					selectedDate.getFullYear(),
					selectedDate.getMonth(),
					selectedDate.getDate(),
					parseInt( hours, 10 ),
					parseInt( minutes, 10 ),
					0
				)
			);
			return formatTimeString( date );
		},
		[ selectedDate ]
	);

	const handleDateSelect = useCallback(
		( date ) => {
			if (
				selectedDate &&
				date.getTime() === selectedDate.getTime()
			) {
				setSelectedDate( null );
				return;
			}
			setSelectedDate( date );
			const newMonth = new Date(
				date.getFullYear(),
				date.getMonth(),
				1
			);
			if ( newMonth.getTime() !== visibleMonth.getTime() ) {
				setVisibleMonth( newMonth );
			}
		},
		[ selectedDate, visibleMonth ]
	);

	const handleMonthChange = useCallback(
		( date ) => {
			const newMonth = new Date(
				date.getFullYear(),
				date.getMonth(),
				1
			);
			if ( newMonth.getTime() !== visibleMonth.getTime() ) {
				setVisibleMonth( newMonth );
			}
		},
		[ visibleMonth ]
	);

	return {
		visibleMonth,
		currentMonthStart,
		selectedDate,
		isDateDisabled,
		resourceId,
		setResourceId,
		handleDateSelect,
		handleMonthChange,
		selectedSlot,
		setSelectedSlot,
		availableSlots,
		isLoadingSlots,
		formatSlotTime,
		updateAvailabilityAfterReschedule,
	};
}
