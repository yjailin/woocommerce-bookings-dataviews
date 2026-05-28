/**
 * Modal booking flow — frontend behaviour.
 *
 * The form markup inside #wc-bookings-modal is identical to the inline
 * template that woocommerce-bookings normally renders, so the core
 * `wc-bookings-booking-form` script handles price preview, availability,
 * and submit-button disabled state. This module only:
 *
 *   1. opens / closes the <dialog>
 *   2. traps focus and restores it on close
 *   3. mirrors the submit button's disabled state onto "Proceed to Checkout"
 *   4. resets the form when the modal closes so each open starts fresh
 *   5. flags POST requests that should land on /checkout after add-to-cart
 */

import './modal-booking.scss';

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'area[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join( ',' );

function ready( fn ) {
	if ( document.readyState !== 'loading' ) {
		fn();
	} else {
		document.addEventListener( 'DOMContentLoaded', fn );
	}
}

function getFocusable( root ) {
	return Array.from( root.querySelectorAll( FOCUSABLE_SELECTOR ) ).filter(
		( el ) => ! el.hasAttribute( 'hidden' ) && el.offsetParent !== null
	);
}

/**
 * Mirror the body's *computed* background color onto the modal panel.
 *
 * CSS variables can't do this reliably across themes — Twenty Twenty-Five
 * variations, for instance, set the body background to a literal value
 * rather than via `--wp--preset--color--background` (which is undefined
 * in some variations). The only theme-agnostic source of truth is the
 * actual computed style of <body>.
 */
function syncPanelBackgroundToBody() {
	const panel = document.querySelector( '#wc-bookings-modal .wc-bookings-modal__panel' );
	if ( ! panel ) {
		return;
	}
	const bodyBg = window.getComputedStyle( document.body ).backgroundColor;
	if ( bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent' ) {
		panel.style.backgroundColor = bodyBg;
	}
}

/**
 * Mirror the WC Blocks mini-cart drawer's *computed* overlay colour onto
 * our modal's backdrop, via a CSS custom property.
 *
 * WC Blocks ships `.wc-block-components-drawer__screen-overlay` with
 * `background-color: rgba(95, 95, 95, .35)` (see WC's mini-cart.css).
 * If WC ever changes that value — or a theme overrides it — we want
 * our modal's backdrop to track it instead of staying pinned to a
 * literal we copied at build time.
 *
 * Implementation: mount a hidden reference element with the drawer's
 * overlay class, read its computed `background-color`, publish that
 * value as `--wcb-modal-backdrop` on `<html>` so it's available to:
 *
 *   - `dialog.wc-bookings-modal[open]::backdrop` (native path),
 *   - `.wc-bookings-modal.is-open` (polyfill path),
 *   - the `@keyframes wc-bookings-modal-fade` keyframe (polyfill fade).
 *
 * If the mini-cart CSS isn't loaded on the page (the bg-color reads as
 * `rgba(0, 0, 0, 0)` / transparent), we leave the variable unset and
 * the SCSS fallback (`rgba(95, 95, 95, 0.35)`) wins. Graceful degrade.
 */
function syncBackdropFromMiniCart() {
	const ref = document.createElement( 'div' );
	ref.className = 'wc-block-components-drawer__screen-overlay';
	ref.setAttribute( 'aria-hidden', 'true' );
	// Inline overrides neutralise the class's `position: fixed; inset: 0`
	// so the reference doesn't briefly cover the viewport. Computed
	// `background-color` is unaffected by these positioning / size
	// overrides.
	ref.style.cssText =
		'position:absolute;left:-9999px;top:-9999px;width:0;height:0;visibility:hidden;pointer-events:none';
	document.body.appendChild( ref );

	const refBg = window.getComputedStyle( ref ).backgroundColor;
	ref.remove();

	if ( ! refBg || refBg === 'rgba(0, 0, 0, 0)' || refBg === 'transparent' ) {
		return;
	}

	document.documentElement.style.setProperty( '--wcb-modal-backdrop', refBg );
}

function initModal() {
	const dialog = document.getElementById( 'wc-bookings-modal' );
	const trigger = document.querySelector( '.wc-bookings-modal-trigger' );

	if ( ! dialog || ! trigger ) {
		return;
	}

	syncPanelBackgroundToBody();
	syncBackdropFromMiniCart();

	const form = dialog.querySelector( '.wc-bookings-modal__form' );
	const closeBtn = dialog.querySelector( '.wc-bookings-modal__close' );
	const checkoutBtn = dialog.querySelector( '.wc-bookings-modal__checkout' );
	const submitBtn = dialog.querySelector( '.wc-bookings-booking-form-button' );
	const redirectFlag = dialog.querySelector( '.wc-bookings-modal__redirect-flag' );

	if ( ! form || ! submitBtn ) {
		return;
	}

	const nativeDialog = typeof dialog.showModal === 'function';
	// Mirrors `$modal-transition-duration` in modal-booking.scss —
	// used as the upper bound for the safety timeout that triggers
	// `finalizeClose` if `animationend` never fires.
	const ANIM_DURATION = 220;
	let lastTrigger = null;
	let pendingCloseTimer = null;
	let pendingAnimationHandler = null;

	function open() {
		lastTrigger = document.activeElement;
		dialog.removeAttribute( 'hidden' );

		if ( nativeDialog ) {
			try {
				dialog.showModal();
			} catch ( e ) {
				// Already open — fall through.
			}
		} else {
			dialog.classList.add( 'is-open' );
		}

		document.body.classList.add( 'wc-bookings-modal-open' );

		// The panel's entry animation is owned by CSS — see
		// `@keyframes wcb-panel-in` in modal-booking.scss. The keyframe
		// runs automatically because the [open] / .is-open selector
		// just started matching the panel. No JS needs to time, queue,
		// or trigger the animation.

		requestAnimationFrame( () => {
			// Auto-focus target priority:
			//   1. The first focusable element INSIDE the modal body
			//      (typically the first booking-form field), so the
			//      user starts on the actual form rather than the
			//      close button that sits first in DOM order.
			//   2. Fallback to the dialog element itself if no body-
			//      level focusable exists (degenerate template).
			const body = dialog.querySelector( '.wc-bookings-modal__body' );
			const bodyFocusables = body ? getFocusable( body ) : [];
			const target = bodyFocusables[ 0 ] || dialog;
			target.focus();
		} );
	}

	function finalizeClose() {
		if ( nativeDialog && dialog.open ) {
			dialog.close();
		} else {
			dialog.classList.remove( 'is-open' );
		}

		// Drop the closing class so the next open() doesn't start
		// with the exit animation still attached.
		dialog.classList.remove( 'is-closing' );

		document.body.classList.remove( 'wc-bookings-modal-open' );

		// State preservation: when the user dismisses the modal
		// (close button / Escape / backdrop click), keep the form
		// fields, the cost band visibility, and the submit button
		// state intact so a re-open shows exactly what was visible
		// at close. The previous "reset everything" behaviour wiped
		// any selected time slot and the price/error preview, which
		// forced customers to start over each time they reopened.
		//
		// The redirect flag IS still cleared — it shouldn't carry
		// across opens (otherwise a stale "send to checkout on
		// submit" intent could surprise the user).
		if ( redirectFlag ) {
			redirectFlag.value = '';
		}

		if ( lastTrigger && typeof lastTrigger.focus === 'function' ) {
			lastTrigger.focus();
		}
	}

	function close() {
		const panel = dialog.querySelector( '.wc-bookings-modal__panel' );
		if ( ! panel ) {
			finalizeClose();
			return;
		}

		// Cancel any earlier in-flight close so we don't double-fire.
		clearPendingClose();

		// Add `is-closing` to trigger the CSS fade-out animation
		// (`@keyframes wcb-panel-out` in modal-booking.scss). When the
		// animation ends, dismiss the dialog. The class is removed
		// inside finalizeClose so the next open starts clean.
		dialog.classList.add( 'is-closing' );

		pendingAnimationHandler = ( e ) => {
			if ( e.target !== panel || e.animationName !== 'wcb-panel-out' ) {
				return;
			}
			clearPendingClose();
			finalizeClose();
		};
		panel.addEventListener( 'animationend', pendingAnimationHandler );

		// Safety net: if `animationend` never fires (panel removed,
		// browser bug, prefers-reduced-motion shortcutting), force
		// the close after the expected duration plus a small buffer.
		pendingCloseTimer = setTimeout( () => {
			clearPendingClose();
			finalizeClose();
		}, ANIM_DURATION + 130 );
	}

	function clearPendingClose() {
		if ( pendingCloseTimer ) {
			clearTimeout( pendingCloseTimer );
			pendingCloseTimer = null;
		}
		if ( pendingAnimationHandler ) {
			const panel = dialog.querySelector( '.wc-bookings-modal__panel' );
			if ( panel ) {
				panel.removeEventListener( 'animationend', pendingAnimationHandler );
			}
			pendingAnimationHandler = null;
		}
	}

	function trapTab( e ) {
		if ( e.key !== 'Tab' ) {
			return;
		}
		const focusables = getFocusable( dialog );
		if ( focusables.length === 0 ) {
			e.preventDefault();
			return;
		}
		const first = focusables[ 0 ];
		const last = focusables[ focusables.length - 1 ];

		if ( e.shiftKey && document.activeElement === first ) {
			e.preventDefault();
			last.focus();
		} else if ( ! e.shiftKey && document.activeElement === last ) {
			e.preventDefault();
			first.focus();
		}
	}

	function syncCheckoutButton() {
		if ( ! checkoutBtn ) {
			return;
		}
		// Mirror exactly what core does to the submit button — class
		// only. Reading `hasAttribute('disabled')` here would surface a
		// stale attribute that core can't clear.
		const disabled = submitBtn.classList.contains( 'disabled' );

		// Class only — never the HTML `disabled` attribute. Setting
		// the attribute would prevent the click event from firing, so
		// the `click` handler below (which routes to the submit button
		// so WC's `single_add_to_cart_button` click handler can show
		// its `i18n_choose_options` alert) wouldn't run when the user
		// clicks the "Go to checkout" button in its invalid state. WC
		// itself follows the same convention on the underlying submit
		// button.
		checkoutBtn.classList.toggle( 'disabled', disabled );
	}

	// Mirror disabled state of the submit button onto "Proceed to Checkout".
	const observer = new MutationObserver( syncCheckoutButton );
	observer.observe( submitBtn, {
		attributes: true,
		attributeFilter: [ 'class', 'disabled' ],
	} );

	trigger.addEventListener( 'click', open );

	if ( closeBtn ) {
		closeBtn.addEventListener( 'click', close );
	}

	// ESC dismissal — the native <dialog> fires `cancel`; mirror our
	// own cleanup so the form is reset either way.
	dialog.addEventListener( 'cancel', ( e ) => {
		e.preventDefault();
		close();
	} );

	// Backdrop click on native <dialog>: a click directly on the dialog
	// element (outside the panel) closes.
	dialog.addEventListener( 'click', ( e ) => {
		if ( e.target === dialog ) {
			close();
		}
	} );

	// Focus trap for the polyfill path (native <dialog> handles its own).
	dialog.addEventListener( 'keydown', ( e ) => {
		if ( ! nativeDialog ) {
			trapTab( e );
		}
		if ( e.key === 'Escape' && ! nativeDialog ) {
			close();
		}
	} );

	if ( checkoutBtn ) {
		checkoutBtn.addEventListener( 'click', ( e ) => {
			if ( checkoutBtn.classList.contains( 'disabled' ) ) {
				// Same "invalid selections" state as the Add-to-cart
				// button. Route the click through the submit button
				// so WC's existing handler on `.single_add_to_cart_
				// button` (in booking-form.js) fires its
				// `i18n_choose_options` alert — same message and same
				// UX as if the user had clicked the Add-to-cart button
				// directly. WC's handler also `preventDefault`s, so
				// the form doesn't submit.
				e.preventDefault();
				submitBtn.click();
				return;
			}
			if ( redirectFlag ) {
				redirectFlag.value = '1';
			}
			submitBtn.click();
		} );
	}
}

ready( initModal );
