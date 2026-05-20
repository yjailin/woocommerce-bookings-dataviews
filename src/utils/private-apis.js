/**
 * Opt-in to the @wordpress private-apis registry by impersonating a
 * whitelisted core module name. The gate
 * (`__dangerousOptInToUnstableAPIsOnlyForCoreModules`) only allows the
 * hardcoded list of first-party `@wordpress/*` packages to opt in, so
 * to read `DateCalendar` from `@wordpress/components`'s `privateApis`
 * (the calendar CIAB uses) this plugin has to identify as one of those
 * modules. CIAB does the equivalent via `@automattic/admin-toolkit`,
 * which embeds the unlock for first-party code.
 *
 * Trade-off is exactly what the consent string warns: this may stop
 * working on a future WordPress release. The fallback would be to swap
 * back to the public `DatePicker`, accepting the visual delta.
 */

import { __dangerousOptInToUnstableAPIsOnlyForCoreModules } from '@wordpress/private-apis';

export const { unlock, lock } =
	__dangerousOptInToUnstableAPIsOnlyForCoreModules(
		'I acknowledge private features are not for use in themes or plugins and doing so will break in the next version of WordPress.',
		'@wordpress/edit-site'
	);
