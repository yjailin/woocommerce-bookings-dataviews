/**
 * Always-on WC Bookings frontend tweaks.
 *
 * Three fixes that should apply on every bookable product page,
 * regardless of whether the Modal booking flow feature flag is on:
 *
 *   1. Add the `wp-element-button` class to the inline form's Add to
 *      Cart button. WC core adds this class automatically for every
 *      product type EXCEPT bookings — without it, block themes don't
 *      style the button.
 *
 *   2. Visual cleanup (in bookings-frontend.scss): strip WC Bookings'
 *      legacy nested-container borders so the form fits modern block
 *      themes instead of looking like a framed 2014-era widget.
 *
 *   3. Make each person-type number input render with the EXACT same
 *      DOM shape WC core uses for product-quantity steppers:
 *        <div class="quantity">
 *            <input class="input-text qty text" type="number" …>
 *        </div>
 *      Themes that style `.input-text.qty.text` (and most block themes
 *      do, via WC's CSS class hooks) will then style the booking person
 *      field identically. No theme-specific CSS in our plugin — full
 *      parity comes from the markup.
 *
 * When the modal flag is ON the inline form isn't rendered, so the JS
 * selectors match nothing and the CSS rules harmlessly target nothing.
 */

import './bookings-frontend.scss';

function applyThemedButtonClass() {
	document
		.querySelectorAll( '.wc-bookings-booking-form-button.single_add_to_cart_button' )
		.forEach( ( el ) => el.classList.add( 'wp-element-button' ) );
}

/**
 * Wrap each person-type input in <div class="quantity"> and apply the
 * standard `input-text qty text` classes WC uses for product quantity
 * steppers. This makes the person field inherit whatever the theme
 * (and WC core) decides a quantity stepper looks like — including the
 * native browser arrows on hover — so the bookable product page reads
 * the same as a non-bookable one on any theme.
 */
function applyQuantityShapeToPersonInputs() {
	const inputs = document.querySelectorAll(
		'.wc-bookings-booking-form input[name^="wc_bookings_field_persons"]'
	);

	inputs.forEach( ( input ) => {
		wrapInputAsQuantityStepper( input );
	} );
}

function wrapInputAsQuantityStepper( input ) {
	// Idempotency — bail if we already wrapped this input.
	if ( input.parentElement && input.parentElement.classList.contains( 'quantity' ) ) {
		return;
	}

	// Mirror WC's quantity input class set.
	input.classList.add( 'input-text', 'qty', 'text' );

	// Wrap in <div class="quantity">.
	const wrapper = document.createElement( 'div' );
	wrapper.className = 'quantity';
	input.parentNode.insertBefore( wrapper, input );
	wrapper.appendChild( input );
}

/**
 * Mirror the theme's `.variations select` styling onto the booking
 * resource select.
 *
 * Bookable products use `<select id="wc_bookings_field_resource">`
 * inside `.wc-bookings-booking-form .form-field` — none of that matches
 * the `.variations select` selector chain that themes and WC core
 * target. So our SCSS hard-codes WC core's *default* chevron / padding /
 * background. The problem: any theme that customises `.variations
 * select` (different SVG, padding, background colour, etc.) will diverge
 * from the booking page.
 *
 * We can't add the variations selector chain to the booking form without
 * fighting WC Bookings' template, so instead we render a hidden
 * reference structure that matches the chain `.variations select` is
 * scoped to, read its computed styles, and copy them onto the real
 * booking select. Result: whatever the theme computes for variation
 * selects ends up on the resource select too.
 */
function syncResourceSelectStyling() {
	const targets = document.querySelectorAll( '.wc-bookings-booking-form select' );
	if ( targets.length === 0 ) {
		return;
	}

	// Off-screen reference structure carrying the variation-select
	// selector chain. Wrapping in `.product` + `form.cart` matches both
	// classic WC and the block add-to-cart wrapper variants.
	const ref = document.createElement( 'div' );
	ref.className = 'wp-block-woocommerce-add-to-cart-form woocommerce';
	ref.setAttribute( 'aria-hidden', 'true' );
	ref.style.cssText =
		'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;pointer-events:none';
	ref.innerHTML =
		'<div class="product">' +
			'<form class="cart">' +
				'<table class="variations">' +
					'<tbody><tr><td class="value">' +
						'<select><option>x</option></select>' +
					'</td></tr></tbody>' +
				'</table>' +
			'</form>' +
		'</div>';
	document.body.appendChild( ref );

	const refSelect = ref.querySelector( 'select' );
	const refCS = window.getComputedStyle( refSelect );

	// Properties that affect the dropdown's visual identity. Width and
	// min-width deliberately omitted — those are layout decisions made
	// by the booking form, not the variation select. `background-color`
	// is omitted on purpose so the SCSS default (white) always wins —
	// some themes make the variation select transparent over a coloured
	// page bg, which would make the resource select unreadable.
	const props = [
		'background-image',
		'background-position',
		'background-size',
		'background-repeat',
		'-webkit-appearance',
		'appearance',
		'padding',
		'border',
		'border-radius',
		'height',
		'min-height',
		'font-size',
		'font-family',
		'color',
		'box-shadow',
	];

	targets.forEach( ( target ) => {
		props.forEach( ( prop ) => {
			const value = refCS.getPropertyValue( prop );
			if ( value ) {
				target.style.setProperty( prop, value );
			}
		} );
	} );

	// Publish the theme's computed select border-radius as a CSS
	// custom property on the booking form wrapper, so the SCSS-driven
	// container border (`.wc-bookings-booking-form { border-radius:
	// var(--wcb-form-radius, …) }`) tracks the theme's input radius
	// — no extra reference structure needed since we already built
	// one above.
	const refRadius = refCS.getPropertyValue( 'border-radius' );
	if ( refRadius ) {
		document
			.querySelectorAll( '.wc-bookings-booking-form' )
			.forEach( ( form ) =>
				form.style.setProperty( '--wcb-form-radius', refRadius )
			);
	}

	ref.remove();
}

/**
 * Make the timezone notice and the empty-state line read as one
 * sentence: "Times are in <TZ>. Choose a date above to see available
 * times." We hide the original notice (it lives inside the calendar
 * fieldset above the calendar) and prepend its text into the
 * empty-state <li> inside .block-picker.
 *
 * Once a date is picked, core's time-picker.js replaces the empty
 * <li> with `<li class="block">` slot items — the timezone text
 * disappears naturally with the empty-state. A MutationObserver
 * re-prepends if the empty state ever comes back (e.g. date cleared).
 */
function mergeTimezoneIntoEmptyState() {
	const tz = document.querySelector(
		'.wc-bookings-booking-form .wc-bookings-date-picker-timezone-block'
	);
	const blockPicker = document.querySelector(
		'.wc-bookings-booking-form .block-picker'
	);
	if ( ! tz || ! blockPicker ) {
		return;
	}

	const tzText = tz.textContent.trim();
	if ( ! tzText ) {
		return;
	}
	// Ensure the timezone string ends with a period so the combined
	// line reads as proper prose.
	const tzSentence = /[.!?]$/.test( tzText ) ? tzText : `${ tzText }.`;

	// Hide the original notice — its text now lives inline with the
	// empty-state line.
	tz.style.display = 'none';

	function injectIntoEmptyState() {
		const li = blockPicker.querySelector( 'li:not(.block)' );
		if ( ! li ) {
			return;
		}
		if ( li.dataset.wcbTzMerged === '1' ) {
			return;
		}
		li.textContent = `${ tzSentence } ${ li.textContent.trim() }`;
		li.dataset.wcbTzMerged = '1';
	}

	injectIntoEmptyState();

	// Core re-renders .block-picker via AJAX when a date is selected /
	// cleared. Re-inject if the empty state comes back later.
	const observer = new MutationObserver( injectIntoEmptyState );
	observer.observe( blockPicker, { childList: true } );
}

/**
 * Move `.wc-bookings-booking-cost` (the price-preview / error band)
 * OUT of `.wc-bookings-booking-form` and place it immediately before
 * the Book Now button.
 *
 * After the previous change that wrapped the form controls in a subtle
 * themed container, the cost band — both the calculated price ($X) and
 * the inline error like "The minimum persons per group is 1" — read as
 * a control inside that container. The user wants it instead to live
 * just above the submit button, with no gap between them, so the band
 * reads as a "status line" for the action rather than another field.
 *
 * The band stays inside `<form class="cart">`, so WC's JS hooks (which
 * target `$form.find('.wc-bookings-booking-cost')`) still find it.
 * Inserting it as the IMMEDIATE previous sibling of the button is
 * intentional — the CSS rule that zeroes the button's top margin uses
 * the adjacent-sibling combinator (`+`), which would skip if any other
 * element landed between them.
 */
function moveCostBandToButtonZone() {
	const cost = document.querySelector( '.wc-bookings-booking-cost' );
	if ( ! cost ) {
		return;
	}

	// MODAL MODE: place the cost band as the immediate previous sibling
	// of the modal footer (between `.wc-bookings-modal__body` and
	// `.wc-bookings-modal__footer`). That positions it visually between
	// the time slots above and the action buttons below, with symmetric
	// external spacing (`.wc-bookings-modal__form > .wc-bookings-booking
	// -cost` rule handles padding/margins in modal-booking.scss).
	const modalFooter = document.querySelector( '.wc-bookings-modal__footer' );
	if ( modalFooter ) {
		if ( modalFooter.previousElementSibling !== cost ) {
			modalFooter.parentNode.insertBefore( cost, modalFooter );
		}
		return;
	}

	// STANDALONE PRODUCT PAGE: place the cost band just before the
	// original WC submit button so it reads as a status line glued to
	// the Book Now action.
	const form = document.getElementById( 'wc-bookings-booking-form' );
	if ( ! form ) {
		return;
	}
	const scope = form.parentNode || document;
	const button = scope.querySelector( '.wc-bookings-booking-form-button' );
	if ( ! button ) {
		return;
	}
	if ( button.previousElementSibling === cost ) {
		return; // Idempotent — already in the right place.
	}
	button.parentNode.insertBefore( cost, button );
}

/**
 * Force the inline calendar to render BELOW the date inputs instead of
 * above them. WC Bookings' template lays the fieldset out as:
 *
 *   <fieldset class="wc-bookings-date-picker">
 *     <div class="picker"></div>                  ← calendar renders here
 *     <span class="label">Date</span>:
 *     <div class="wc-bookings-date-picker-date-fields">…</div>
 *   </fieldset>
 *
 * jQuery UI's datepicker initialises on `.picker` and renders inline
 * inside it, so the calendar always appears ABOVE the typed date
 * inputs. CSS reordering (flex `order`, grid areas) is blocked by the
 * raw `:` text node — it becomes an anonymous flex item and ends up
 * on its own line. Moving the node in the DOM is the clean fix and
 * works the same on classic and block themes.
 *
 * We move it before jQuery UI initialises so the picker mounts at its
 * new position. Even if our script ran later, jQuery UI doesn't pin
 * the calendar to a viewport coordinate — re-parenting the host div
 * carries the rendered calendar with it.
 */
function moveCalendarBelowDateInputs() {
	document
		.querySelectorAll( '.wc-bookings-booking-form .wc-bookings-date-picker' )
		.forEach( ( fieldset ) => {
			const picker = fieldset.querySelector( ':scope > .picker' );
			if ( picker && fieldset.lastElementChild !== picker ) {
				fieldset.appendChild( picker );
			}
		} );
}

/**
 * Mirror an unselected bookable day's computed background colour onto
 * the SELECTED day (`.ui-datepicker-current-day`).
 *
 * WC ships
 *
 *   .wc-bookings-date-picker .ui-datepicker td.bookable a { background-color: #1f874b !important }
 *   .wc-bookings-date-picker .ui-datepicker td.ui-datepicker-current-day a { background: #176d3b !important }
 *
 * — so the selected day ends up a noticeably darker green than the
 * unselected bookable days. Themes routinely override the bookable
 * green with their own accent colour (e.g. purple), but they don't
 * touch the `ui-datepicker-current-day` darker-green rule. The
 * result on those themes: bookable days are themed, selected day is
 * still WC's hardcoded `#176d3b`.
 *
 * A pure-CSS override can't express "use whatever colour the .bookable
 * rule eventually resolved to in this stylesheet cascade" — CSS has no
 * "inherit from sibling rule" mechanism. So we read the computed
 * `background-color` of an actual bookable day at runtime and apply
 * it to the selected day via an inline `!important` style, which
 * outranks every author rule.
 *
 * Re-runs on calendar mutations (month navigation, day selection,
 * resource changes) so the colour stays correct after the calendar
 * re-renders, and clears its own inline style on the previously
 * selected day so old days don't carry stale colours.
 */
function syncSelectedDayBgFromBookable() {
	const picker = document.querySelector(
		'.wc-bookings-booking-form .picker'
	);
	if ( ! picker ) {
		return;
	}

	let lastStyled = null;

	function apply() {
		// Clean up the previously styled day so it falls back to
		// whatever the cascade would now give it (probably the
		// .bookable rule).
		if ( lastStyled ) {
			lastStyled.style.removeProperty( 'background' );
			lastStyled.style.removeProperty( 'background-color' );
			lastStyled.style.removeProperty( 'background-image' );
			lastStyled = null;
		}

		const sample = picker.querySelector(
			'td.bookable:not(.ui-datepicker-current-day) a, ' +
			'td.partial_booked:not(.ui-datepicker-current-day) a'
		);
		const selected = picker.querySelector(
			'td.ui-datepicker-current-day a'
		);
		if ( ! sample || ! selected ) {
			return;
		}

		const bg = window.getComputedStyle( sample ).backgroundColor;
		if (
			! bg ||
			bg === 'rgba(0, 0, 0, 0)' ||
			bg === 'transparent'
		) {
			return;
		}

		selected.style.setProperty( 'background-color', bg, 'important' );
		selected.style.setProperty( 'background-image', 'none', 'important' );
		lastStyled = selected;
	}

	apply();

	// Watch for calendar re-renders (jQuery UI swaps the whole table
	// on month change; class changes happen on day selection).
	const observer = new MutationObserver( apply );
	observer.observe( picker, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [ 'class' ],
	} );
}

/**
 * Style each loaded time-slot <a> as a theme-aware toggle button by
 * adding the `wp-element-button` class. The theme's button-block CSS
 * then provides typography + border-radius automatically; our SCSS
 * handles the color toggle (contrast outline vs contrast fill).
 *
 * Slots load via AJAX whenever the customer picks a date, so we also
 * watch .block-picker for childList changes and reapply.
 */
function applyToggleClassesToTimeSlots() {
	const picker = document.querySelector( '.wc-bookings-booking-form .block-picker' );
	if ( ! picker ) {
		return;
	}

	function tag() {
		picker.querySelectorAll( 'li.block > a' ).forEach( ( a ) => {
			a.classList.add( 'wp-element-button' );
		} );
	}

	tag();

	const observer = new MutationObserver( tag );
	observer.observe( picker, { childList: true, subtree: true } );
}

function init() {
	applyThemedButtonClass();
	applyQuantityShapeToPersonInputs();
	syncResourceSelectStyling();
	mergeTimezoneIntoEmptyState();
	applyToggleClassesToTimeSlots();
	moveCalendarBelowDateInputs();
	moveCostBandToButtonZone();
	syncSelectedDayBgFromBookable();
}

if ( document.readyState !== 'loading' ) {
	init();
} else {
	document.addEventListener( 'DOMContentLoaded', init );
}
