/**
 * Fetch monthly product availability through this plugin's REST proxy.
 *
 * Ported from CIAB's `utils/availability/fetch-availability.ts`. Two
 * deltas from CIAB:
 *   • Hits `<REST_BASE>/products/{id}/availability` instead of the
 *     core wc-bookings v2 namespace, so the plugin can ship without
 *     depending on the v2 store endpoint being exposed.
 *   • TS types stripped; the cache module owns the response shape.
 */

import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

const REST_BASE = window.WC_BOOKINGS_DATAVIEWS_DATA?.restUrl || '';

export { AvailabilityCache } from './availability-cache';

export async function fetchMonthAvailability(
	cache,
	productId,
	resourceId,
	year,
	month,
	timezoneOffset = -new Date().getTimezoneOffset() / 60
) {
	const monthKey = `${ year }-${ String( month + 1 ).padStart( 2, '0' ) }`;
	const cacheKey = cache.generateKey(
		productId,
		resourceId,
		monthKey,
		timezoneOffset
	);

	let response = cache.get( cacheKey );
	if ( response ) {
		return response;
	}

	try {
		const now = new Date();
		const isCurrentMonth =
			year === now.getFullYear() && month === now.getMonth();

		let startDateUTC;
		if ( isCurrentMonth ) {
			startDateUTC = new Date(
				Date.UTC(
					now.getFullYear(),
					now.getMonth(),
					now.getDate(),
					0,
					0,
					0
				)
			);
		} else {
			startDateUTC = new Date( Date.UTC( year, month, 1, 0, 0, 0 ) );
		}

		const lastDayOfMonth = new Date(
			Date.UTC( year, month + 1, 0, 23, 59, 59 )
		);

		const startDateStr = startDateUTC
			.toISOString()
			.slice( 0, 19 )
			.replace( 'T', ' ' );
		const endDateStr = lastDayOfMonth
			.toISOString()
			.slice( 0, 19 )
			.replace( 'T', ' ' );
		const finalStartDateStr =
			now > startDateUTC
				? now.toISOString().slice( 0, 19 ).replace( 'T', ' ' )
				: startDateStr;
		const finalEndDateStr =
			now > lastDayOfMonth
				? now.toISOString().slice( 0, 19 ).replace( 'T', ' ' )
				: endDateStr;

		const queryParams = {
			start_date: finalStartDateStr,
			end_date: finalEndDateStr,
		};

		if ( resourceId && resourceId > 0 ) {
			queryParams.resource_id = resourceId;
		}

		const path = addQueryArgs(
			`${ REST_BASE }products/${ productId }/availability`,
			queryParams
		);

		response = await apiFetch( { path } );
		cache.set( cacheKey, response );
		return response;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Failed to fetch availability for month:', error );
		return null;
	}
}
