/**
 * Date helpers used by the reschedule modal and its hooks.
 *
 * Ported from CIAB's `utils/dates.ts`. Functions return string keys
 * compatible with the availability API response shape:
 *   month → "YYYY-MM"
 *   day   → "YYYY-MM-DD"
 *   slot  → "HH:mm:ss"
 */

import { dateI18n } from '@wordpress/date';

const pad = ( n ) => String( n ).padStart( 2, '0' );

// All key helpers read UTC components: the availability API formats day
// and slot keys with `gmdate( 'Y-m-d' | 'H:i:s', $ts )`, so its keys are
// always UTC-anchored. Reading local fields here would drift by the
// browser's UTC offset, breaking slot/day matching against the API.

export function getMonthKey( date ) {
	return `${ date.getUTCFullYear() }-${ pad( date.getUTCMonth() + 1 ) }`;
}

export function getDayKey( date ) {
	return `${ date.getUTCFullYear() }-${ pad(
		date.getUTCMonth() + 1
	) }-${ pad( date.getUTCDate() ) }`;
}

export function formatSlotKey( date ) {
	return `${ pad( date.getUTCHours() ) }:${ pad(
		date.getUTCMinutes()
	) }:${ pad( date.getUTCSeconds() ) }`;
}

/**
 * Build a JS Date at `selectedDate`'s Y/M/D with the slot's H:m:s,
 * anchored to UTC. The availability API formats slot keys with
 * `gmdate( 'H:i:s', $ts )`, so "08:00:00" *means* 8 a.m. UTC — and
 * `formatSlotTime` renders the slot label by building the date with
 * `Date.UTC(...)` too. The submission path has to use the same
 * anchoring or the timestamp we POST would be off by the browser's
 * UTC offset.
 */
export function buildSlotDateTime( selectedDate, slot ) {
	const [ hh, mm, ss ] = slot.split( ':' ).map( ( v ) => parseInt( v, 10 ) );
	return new Date(
		Date.UTC(
			selectedDate.getFullYear(),
			selectedDate.getMonth(),
			selectedDate.getDate(),
			hh || 0,
			mm || 0,
			ss || 0
		)
	);
}

/**
 * Add a booking duration to a start Date and return the end Date.
 * Mirrors CIAB's `calculateEndDate`.
 */
export function calculateEndDate( startDate, duration, durationUnit ) {
	const end = new Date( startDate.getTime() );
	const amount = Number( duration ) || 1;
	switch ( durationUnit ) {
		case 'month':
			end.setMonth( end.getMonth() + amount );
			break;
		case 'day':
			end.setDate( end.getDate() + amount );
			break;
		case 'hour':
			end.setHours( end.getHours() + amount );
			break;
		case 'minute':
		default:
			end.setMinutes( end.getMinutes() + amount );
			break;
	}
	return end;
}

/**
 * Localized date / time strings. Both helpers read the site-wide format
 * settings (Settings → General) passed in via `WC_BOOKINGS_DATAVIEWS_DATA`
 * (see the wp_localize_script call in WC_Bookings_DataViews_Page) so the
 * client mirrors what PHP renders. Fallback constants match the
 * `wc_bookings_date_format()` / `wc_bookings_time_format()` defaults so
 * the modal stays consistent with the rest of WC Bookings when the
 * option is empty.
 */
export function formatDateString( date ) {
	const fmt = window.WC_BOOKINGS_DATAVIEWS_DATA?.dateFormat || 'F j, Y';
	return dateI18n( fmt, date );
}

export function formatTimeString( date ) {
	const fmt = window.WC_BOOKINGS_DATAVIEWS_DATA?.timeFormat || 'g:i a';
	return dateI18n( fmt, date );
}
