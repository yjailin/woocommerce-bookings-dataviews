/**
 * Webpack config override for wp-scripts.
 *
 * Bundles `@wordpress/route` instead of externalizing it. The default
 * DependencyExtractionWebpackPlugin in wp-scripts 30.x maps every
 * `@wordpress/*` import to a `wp-*` script handle. `wp-route` is not
 * registered as a script handle in this WP build, so the externalized
 * import resolves to `undefined` at runtime — which breaks
 * `@wordpress/admin-ui`'s `<Breadcrumbs>` (it depends on `<Link>` from
 * `@wordpress/route`). Bundling the package keeps a single
 * `@tanstack/react-router` instance, so `Link` and our local
 * `<RouterProvider>` share the same context.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );
const {
	defaultRequestToExternal,
	defaultRequestToHandle,
} = require( '@wordpress/dependency-extraction-webpack-plugin/lib/util' );

module.exports = {
	...defaultConfig,
	entry: {
		index: './src/index.js',
		'modal-booking': './src/modal-booking.js',
		'bookings-frontend': './src/bookings-frontend.js',
	},
	plugins: [
		...defaultConfig.plugins.filter(
			( plugin ) =>
				! ( plugin instanceof DependencyExtractionWebpackPlugin )
		),
		new DependencyExtractionWebpackPlugin( {
			useDefaults: false,
			requestToExternal( request ) {
				if ( request === '@wordpress/route' ) {
					return undefined;
				}
				return defaultRequestToExternal( request );
			},
			requestToHandle( request ) {
				if ( request === '@wordpress/route' ) {
					return undefined;
				}
				return defaultRequestToHandle( request );
			},
		} ),
	],
};
