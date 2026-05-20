/**
 * In-memory TTL cache for product availability responses, keyed by
 * (product, resource, month, timezone offset). Mirrors CIAB's
 * `utils/availability/availability-cache.ts` (TS → JS, no public type
 * exports). Cache is intentionally non-singleton: each hook instance
 * keeps its own scope.
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes.

export class AvailabilityCache {
	constructor( defaultTTL = DEFAULT_TTL ) {
		this.cache = new Map();
		this.defaultTTL = defaultTTL;
	}

	generateKey( productId, resourceId, monthKey, timezoneOffset ) {
		const resource = resourceId || 0;
		return `availability:${ productId }:${ resource }:${ monthKey }:${ timezoneOffset }`;
	}

	get( key ) {
		const entry = this.cache.get( key );
		if ( ! entry ) {
			return null;
		}
		if ( Date.now() > entry.expiresAt ) {
			this.cache.delete( key );
			return null;
		}
		return entry.data;
	}

	set( key, data, ttl ) {
		const expiresAt = Date.now() + ( ttl ?? this.defaultTTL );
		this.cache.set( key, { data, expiresAt } );
	}

	isExpired( key ) {
		const entry = this.cache.get( key );
		if ( ! entry ) {
			return true;
		}
		return Date.now() > entry.expiresAt;
	}

	clear( key ) {
		if ( key ) {
			this.cache.delete( key );
		} else {
			this.cache.clear();
		}
	}

	/**
	 * Adjust a single slot's count across every cached entry that covers
	 * the day (product/resource scoped, any timezone). Used after a
	 * reschedule to mark the released slot available again and the newly
	 * taken slot occupied without re-fetching.
	 */
	updateSlot( productId, resourceId, dayKey, slotTime, delta ) {
		const monthKey = dayKey.slice( 0, 7 );
		const resource = resourceId || 0;
		const prefix = `availability:${ productId }:${ resource }:${ monthKey }:`;

		for ( const [ key, entry ] of this.cache.entries() ) {
			if ( ! key.startsWith( prefix ) ) {
				continue;
			}
			if ( Date.now() > entry.expiresAt ) {
				this.cache.delete( key );
				continue;
			}
			const monthData = entry.data.availability?.[ monthKey ];
			if ( ! monthData ) {
				continue;
			}
			const dayData = monthData[ dayKey ];
			if ( ! dayData || ! ( slotTime in dayData ) ) {
				continue;
			}
			dayData[ slotTime ] = Math.max( 0, dayData[ slotTime ] + delta );
		}
	}

	getDefaultTTL() {
		return this.defaultTTL;
	}
}
