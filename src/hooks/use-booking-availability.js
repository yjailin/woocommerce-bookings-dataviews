/**
 * useBookingAvailability — fetches per-month availability buckets and
 * exposes them keyed by "YYYY-MM". One cache instance per hook (per
 * product/resource pair). Ported from CIAB's
 * `hooks/use-booking-availability.ts` (TS → JS).
 */

import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import {
	AvailabilityCache,
	fetchMonthAvailability,
} from '../utils/availability';
import { getMonthKey } from '../utils/dates';

export function useBookingAvailability( productId, resourceId, visibleMonth ) {
	const [ availabilityByMonth, setAvailabilityByMonth ] = useState( {} );
	const [ loadingMonths, setLoadingMonths ] = useState( {} );

	const cacheRef = useRef( null );
	if ( ! cacheRef.current ) {
		cacheRef.current = new AvailabilityCache();
	}

	useEffect( () => {
		const monthKey = getMonthKey( visibleMonth );

		setLoadingMonths( ( prev ) => ( {
			...prev,
			[ monthKey ]: true,
		} ) );

		fetchMonthAvailability(
			cacheRef.current,
			productId,
			resourceId,
			visibleMonth.getFullYear(),
			visibleMonth.getMonth()
		)
			.then( ( response ) => {
				const monthAvailability =
					response?.availability?.[ monthKey ] || {};
				setAvailabilityByMonth( ( prev ) => ( {
					...prev,
					[ monthKey ]: monthAvailability,
				} ) );
				setLoadingMonths( ( prev ) => ( {
					...prev,
					[ monthKey ]: false,
				} ) );
			} )
			.catch( () => {
				setAvailabilityByMonth( ( prev ) => ( {
					...prev,
					[ monthKey ]: {},
				} ) );
				setLoadingMonths( ( prev ) => ( {
					...prev,
					[ monthKey ]: false,
				} ) );
			} );

		// `availabilityByMonth` deliberately omitted — `fetchMonthAvailability`
		// is cached, so re-running on every state change would just thrash.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ visibleMonth, productId, resourceId ] );

	const updateAvailabilityAfterReschedule = useCallback(
		(
			oldDayKey,
			oldSlotTime,
			newDayKey,
			newSlotTime,
			oldDate,
			newDate,
			pId,
			resId
		) => {
			if ( cacheRef.current ) {
				cacheRef.current.updateSlot(
					pId,
					resId,
					oldDayKey,
					oldSlotTime,
					+1
				);
				cacheRef.current.updateSlot(
					pId,
					resId,
					newDayKey,
					newSlotTime,
					-1
				);
			}

			setAvailabilityByMonth( ( prev ) => {
				const next = { ...prev };
				const oldMonthKey = getMonthKey( oldDate );
				const newMonthKey = getMonthKey( newDate );

				if (
					next[ oldMonthKey ]?.[ oldDayKey ]?.[ oldSlotTime ] !==
					undefined
				) {
					next[ oldMonthKey ] = { ...next[ oldMonthKey ] };
					next[ oldMonthKey ][ oldDayKey ] = {
						...next[ oldMonthKey ][ oldDayKey ],
					};
					next[ oldMonthKey ][ oldDayKey ][ oldSlotTime ] = Math.max(
						0,
						next[ oldMonthKey ][ oldDayKey ][ oldSlotTime ] + 1
					);
				}

				if (
					next[ newMonthKey ]?.[ newDayKey ]?.[ newSlotTime ] !==
					undefined
				) {
					next[ newMonthKey ] = { ...next[ newMonthKey ] };
					next[ newMonthKey ][ newDayKey ] = {
						...next[ newMonthKey ][ newDayKey ],
					};
					next[ newMonthKey ][ newDayKey ][ newSlotTime ] = Math.max(
						0,
						next[ newMonthKey ][ newDayKey ][ newSlotTime ] - 1
					);
				}

				return next;
			} );
		},
		[]
	);

	return {
		availabilityByMonth,
		loadingMonths,
		updateAvailabilityAfterReschedule,
	};
}
