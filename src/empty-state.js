import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const BookingIcon = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<g style={ { mixBlendMode: 'multiply' } }>
			<g clipPath="url(#wc-bookings-dv-empty-clip)">
				<path d="M6.20752 19.5444V44.1295C6.20752 46.5863 7.56953 48 9.97459 48H38.025C40.4301 48 41.7921 46.5776 41.7921 44.1295V19.5444C41.7921 17.0876 40.4301 15.6739 38.025 15.6739H9.97459C7.56953 15.6652 6.20752 17.0876 6.20752 19.5444Z" fill="#F0F0F0" />
				<path d="M15.5435 33.7679C16.6383 33.7679 17.5607 32.8972 17.5607 31.7507C17.5607 30.6042 16.69 29.7336 15.5435 29.7336C14.397 29.7336 13.5264 30.6042 13.5264 31.7507C13.5264 32.8972 14.397 33.7679 15.5435 33.7679Z" fill="#E0E0E0" />
				<path d="M24.0001 33.7679C25.0948 33.7679 26.0172 32.8972 26.0172 31.7507C26.0172 30.6042 25.1466 29.7336 24.0001 29.7336C22.8536 29.7336 21.9829 30.6042 21.9829 31.7507C21.9829 32.8972 22.9139 33.7679 24.0001 33.7679Z" fill="#E0E0E0" />
				<path d="M32.4566 33.7679C33.5514 33.7679 34.4738 32.8972 34.4738 31.7507C34.4738 30.6042 33.6031 29.7336 32.4566 29.7336C31.3101 29.7336 30.4395 30.6042 30.4395 31.7507C30.4395 32.8972 31.3704 33.7679 32.4566 33.7679Z" fill="#E0E0E0" />
				<path d="M15.5435 42.4313C16.6383 42.4313 17.5607 41.5606 17.5607 40.4141C17.5607 39.2676 16.69 38.397 15.5435 38.397C14.397 38.397 13.5264 39.2676 13.5264 40.4141C13.5264 41.5606 14.397 42.4313 15.5435 42.4313Z" fill="#E0E0E0" />
				<path d="M24.0001 42.4313C25.0948 42.4313 26.0172 41.5606 26.0172 40.4141C26.0172 39.2676 25.1466 38.397 24.0001 38.397C22.8536 38.397 21.9829 39.2676 21.9829 40.4141C21.9829 41.5606 22.9139 42.4313 24.0001 42.4313Z" fill="#E0E0E0" />
				<path d="M32.4566 42.4313C33.5514 42.4313 34.4738 41.5606 34.4738 40.4141C34.4738 39.2676 33.6031 38.397 32.4566 38.397C31.3101 38.397 30.4395 39.2676 30.4395 40.4141C30.4395 41.5606 31.3704 42.4313 32.4566 42.4313Z" fill="#E0E0E0" />
				<path d="M6.20752 19.5444V24.1563H41.7921V19.5444C41.7921 17.0876 40.4301 15.6739 38.025 15.6739H9.97459C7.56953 15.6739 6.20752 17.0962 6.20752 19.5444Z" fill="#E0E0E0" />
				<path d="M33.008 8.00183H31.6719C30.1978 8.00183 29.3271 8.82076 29.3271 10.3466V18.2083C29.3271 19.6823 30.1461 20.553 31.6719 20.553H33.008C34.4821 20.553 35.3527 19.7341 35.3527 18.2083V10.3466C35.3527 8.87248 34.5338 8.00183 33.008 8.00183Z" fill="#F0F0F0" />
				<path d="M16.3191 8.00183H14.9829C13.5088 8.00183 12.6382 8.82076 12.6382 10.3466V18.2083C12.6382 19.6823 13.4571 20.553 14.9829 20.553H16.3191C17.7931 20.553 18.6638 19.7341 18.6638 18.2083V10.3466C18.6638 8.87248 17.8448 8.00183 16.3191 8.00183Z" fill="#F0F0F0" />
			</g>
		</g>
		<defs>
			<clipPath id="wc-bookings-dv-empty-clip">
				<rect width="35.5846" height="39.9982" fill="white" transform="translate(6.20752 8.00183)" />
			</clipPath>
		</defs>
	</svg>
);

const TAB_CONTENT = {
	today: {
		title: __( 'No bookings today', 'woocommerce-bookings' ),
		description: __( 'Any bookings scheduled for today will appear here.', 'woocommerce-bookings' ),
	},
	upcoming: {
		title: __( 'No upcoming bookings', 'woocommerce-bookings' ),
		description: __( 'New bookings will appear here as customers schedule your services.', 'woocommerce-bookings' ),
	},
	past: {
		title: __( 'No past bookings', 'woocommerce-bookings' ),
		description: __( 'Completed bookings for your services will appear here once they’ve taken place.', 'woocommerce-bookings' ),
	},
	canceled: {
		title: __( 'No canceled bookings', 'woocommerce-bookings' ),
		description: __( 'Bookings that have been canceled will appear here.', 'woocommerce-bookings' ),
	},
};

const DEFAULT_CONTENT = {
	title: __( 'No bookings', 'woocommerce-bookings' ),
	description: __( 'Bookings will appear here when customers start scheduling your services.', 'woocommerce-bookings' ),
};

const FILTERED_CONTENT = {
	title: __( 'No bookings found', 'woocommerce-bookings' ),
	description: __( 'Try clearing some filters or adjusting your search query.', 'woocommerce-bookings' ),
	buttonLabel: __( 'Clear filters', 'woocommerce-bookings' ),
};

function hasActiveFilters( view ) {
	const filters = view?.filters || [];
	const hasFilter = filters.some( ( f ) => {
		if ( f?.value == null ) return false;
		if ( Array.isArray( f.value ) ) return f.value.length > 0;
		return f.value !== '';
	} );
	const hasSearch = ( view?.search ?? '' ).length > 0;
	return hasFilter || hasSearch;
}

export function BookingEmptyState( { slug, view, onClearFilters } ) {
	const isFiltered = hasActiveFilters( view );

	const content = isFiltered
		? FILTERED_CONTENT
		: TAB_CONTENT[ slug ] ?? DEFAULT_CONTENT;

	return (
		<div className="wc-bookings-dv-empty">
			<div className="wc-bookings-dv-empty__visual">
				<BookingIcon />
			</div>
			<h2 className="wc-bookings-dv-empty__title">{ content.title }</h2>
			<p className="wc-bookings-dv-empty__description">{ content.description }</p>
			{ isFiltered && onClearFilters && (
				<div className="wc-bookings-dv-empty__actions">
					<Button variant="secondary" onClick={ onClearFilters }>
						{ FILTERED_CONTENT.buttonLabel }
					</Button>
				</div>
			) }
		</div>
	);
}
