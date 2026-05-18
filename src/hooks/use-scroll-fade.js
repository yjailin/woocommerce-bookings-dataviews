/**
 * useScrollFade — drives the top/bottom gradient fades on the slots
 * list. CIAB exposes this from `hooks/use-scroll-fade` but doesn't
 * publish the source; rebuilt here against the SCSS contract:
 *
 *   --schedule-fade-top-opacity     0  at top    → 1 when scrolled
 *   --schedule-fade-opacity         1 by default → 0  at bottom
 *
 * The fade wrapper hosts the CSS variables; the list element is the
 * scrollable child. We listen to scroll + ResizeObserver so the fade
 * disappears whenever there's nothing left to scroll in that direction.
 */

import { useCallback, useEffect, useRef } from '@wordpress/element';

export function useScrollFade( deps ) {
	const slotsFadeRef = useRef( null );
	const slotsListRef = useRef( null );

	const update = useCallback( () => {
		const list = slotsListRef.current;
		const fade = slotsFadeRef.current;
		if ( ! list || ! fade ) return;
		const { scrollTop, scrollHeight, clientHeight } = list;
		const atTop = scrollTop <= 0;
		const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
		fade.style.setProperty(
			'--schedule-fade-top-opacity',
			atTop ? '0' : '1'
		);
		fade.style.setProperty(
			'--schedule-fade-opacity',
			atBottom ? '0' : '1'
		);
	}, [] );

	useEffect( () => {
		update();
		const list = slotsListRef.current;
		if ( ! list ) return undefined;
		list.addEventListener( 'scroll', update, { passive: true } );
		let observer;
		if ( typeof ResizeObserver !== 'undefined' ) {
			observer = new ResizeObserver( update );
			observer.observe( list );
		}
		return () => {
			list.removeEventListener( 'scroll', update );
			if ( observer ) observer.disconnect();
		};
		// `deps` is the dependency array passed by the caller (the
		// list of slots) — we want to re-measure when slots change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ deps, update ] );

	return { slotsFadeRef, slotsListRef };
}
