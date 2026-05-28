/**
 * Always-on WC Bookings frontend tweaks (layout-only).
 *
 * Visual-restyling shims (resource-select theme mirror, person-input
 * quantity-stepper wrap, calendar selected-day bg shim, timezone-into-
 * empty-state merge, etc.) have been REMOVED — that work will be
 * picked up by a separate "unified front-end controls" extension that
 * owns control styling across all WC templates.
 *
 * What's left here are layout-only behaviours:
 *
 *   1. Add `wp-element-button` to the inline form's Add-to-Cart and
 *      to each time-slot link, so block themes paint them via the
 *      theme's button system. This is a one-class opt-in, not us
 *      styling the elements.
 *
 *   2. Move the inline calendar (`.picker.hasDatepicker`) to be the
 *      last child of the date-picker fieldset so it consistently
 *      renders BELOW the typed Month/Day/Year inputs instead of
 *      above them. Pure DOM reorder.
 *
 *   3. Move the cost preview / error band (`.wc-bookings-booking-
 *      cost`) out of `.wc-bookings-booking-form` and place it
 *      immediately before the Book Now submit button (or, when the
 *      modal flag is on, immediately before the modal footer). Pure
 *      DOM reorder.
 *
 * No styling, no JS-driven design tokens, no MutationObservers.
 */

import './bookings-frontend.scss';

/**
 * Add `wp-element-button` to the inline form's Add-to-Cart button.
 * WC core adds this class automatically for every product type
 * EXCEPT bookings — without it, block themes can't paint the button.
 */
function applyThemedButtonClass() {
	document
		.querySelectorAll( '.wc-bookings-booking-form-button.single_add_to_cart_button' )
		.forEach( ( el ) => el.classList.add( 'wp-element-button' ) );
}

/**
 * Add `wp-element-button` to each time-slot `<a>` so the theme's
 * button-block CSS provides typography + radius + padding. We don't
 * style the slots' colour states — WC's defaults take over for
 * selected vs unselected. The future unified controls extension will
 * own the toggle visuals.
 *
 * Slots load via AJAX whenever the customer picks a date, so we watch
 * `.block-picker` for childList changes and reapply.
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

/**
 * Move the inline calendar BELOW the date inputs.
 *
 *   <fieldset class="wc-bookings-date-picker">
 *     <div class="picker"></div>                  ← calendar renders here
 *     <span class="label">Date</span>:
 *     <div class="wc-bookings-date-picker-date-fields">…</div>
 *   </fieldset>
 *
 * jQuery UI initialises the datepicker on `.picker` and renders inline
 * inside it. Reparenting the host div to be the last child of the
 * fieldset puts the calendar visually below the typed Month/Day/Year
 * inputs. CSS reordering (flex `order`, grid areas) is blocked by the
 * raw `:` text node between the span and the input wrapper — it
 * becomes an anonymous flex item and ends up on its own line. Moving
 * the node in the DOM sidesteps that.
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
 * Move `.wc-bookings-booking-cost` (the price-preview / error band)
 * OUT of `.wc-bookings-booking-form` and place it immediately before
 * the Book Now button (standalone product page) or the modal footer
 * (modal mode). The band ends up reading as a status line for the
 * action below it rather than another field inside the form.
 *
 * The band stays inside `<form class="cart">` / the modal form, so
 * WC's JS hooks (which target `$form.find('.wc-bookings-booking-
 * cost')`) still find it.
 */
function moveCostBandToButtonZone() {
	const cost = document.querySelector( '.wc-bookings-booking-cost' );
	if ( ! cost ) {
		return;
	}

	// MODAL MODE: place the cost band as the immediate previous sibling
	// of the modal footer (between `.wc-bookings-modal__body` and
	// `.wc-bookings-modal__footer`).
	const modalFooter = document.querySelector( '.wc-bookings-modal__footer' );
	if ( modalFooter ) {
		if ( modalFooter.previousElementSibling !== cost ) {
			modalFooter.parentNode.insertBefore( cost, modalFooter );
		}
		return;
	}

	// STANDALONE PRODUCT PAGE: place the cost band just before the
	// original WC submit button.
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

function init() {
	applyThemedButtonClass();
	applyToggleClassesToTimeSlots();
	moveCalendarBelowDateInputs();
	moveCostBandToButtonZone();
}

if ( document.readyState !== 'loading' ) {
	init();
} else {
	document.addEventListener( 'DOMContentLoaded', init );
}
