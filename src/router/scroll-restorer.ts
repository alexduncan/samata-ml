import { $scrollState, recordScroll } from '../stores/scroll.store';
import type { ParsedRoute } from '../types/routes';
import type { ScrollSnapshot } from '../types/state';
import { getEffectiveModelNum, getEffectiveWorkflowRoute } from './router';

let liveScrollTop = 0;
let isRestoringScroll = false;
let restorerInitialized = false;
let cleanupRestorer: (() => void) | undefined;
let activeKey: string | null = null;
let savingEnabled = false;

/**
 * Returns the canonical scroll memory key for a given parsed route.
 * Follows specification/app-state-and-navigation.md §8.2.
 *
 * @param route - Parsed route object.
 * @param dataMode - Sub-mode for /data ('select' | 'preview').
 * @returns The snapshot key string, or null for routes without scroll memory.
 */
export function getScrollKeyForRoute(
	route: ParsedRoute,
	dataMode: 'select' | 'preview' = 'select'
): string | null {
	if (route.kind === 'reserved' && route.underlayPath) route = getEffectiveWorkflowRoute(route);
	if (route.kind !== 'workflow') {
		return null;
	}

	switch (route.path) {
		case '/data':
			return dataMode === 'preview' ? 'data:preview' : 'data:select';
		case '/target':
			return 'target';
		case '/models':
			return 'models';
		case '/results':
			return 'results';
		default:
			const modelNum = getEffectiveModelNum(route);
			return modelNum === undefined ? null : `models/${modelNum}`;
	}
}

/**
 * Records the current document and optional region scroll offsets under the given route key.
 * Saving is disabled while a route scroll restoration is actively in progress (§8.4).
 *
 * @param routeKey - Snapshot key.
 * @param regions - Optional map of named inner scroller offsets.
 */
export function recordCurrentScroll(
	routeKey: string,
	regions?: Record<string, { top: number; left: number }>
): void {
	if (isRestoringScroll) {
		return;
	}

	const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
	const top =
		typeof window !== 'undefined'
			? window.scrollY || document.documentElement?.scrollTop || liveScrollTop
			: liveScrollTop;

	const snapshot: ScrollSnapshot = {
		viewportWidth,
		top,
		regions,
		savedAt: Date.now()
	};

	recordScroll(routeKey, snapshot);
}

/**
 * Restores document scroll for a route key.
 *
 * Follows specification/app-state-and-navigation.md §8.4:
 * 1. Checks snapshot; if viewportWidth differs, aborts and scrolls to top.
 * 2. Awaits viewSettled promise if provided.
 * 3. Scrolls instantly via `window.scrollTo({ top, behavior: 'instant' })`.
 * 4. Aborts immediately upon user scroll input.
 *
 * @param routeKey - Snapshot key to restore.
 * @param whenSettled - Optional promise resolving when view layout height is stable.
 * @returns Promise resolving to true if restored, false if ignored, aborted, or absent.
 */
export async function restoreScroll(
	routeKey: string,
	whenSettled?: Promise<void>
): Promise<boolean> {
	activeKey = routeKey;
	savingEnabled = false;

	try {
		if (typeof window === 'undefined') {
			return false;
		}

		const snapshot = $scrollState.get().snapshots[routeKey];
		if (!snapshot) {
			window.scrollTo({ top: 0, behavior: 'instant' });
			return false;
		}

		// Viewport-width rule (§8.3): ignore snapshot if window.innerWidth differs
		if (snapshot.viewportWidth !== window.innerWidth) {
			window.scrollTo({ top: 0, behavior: 'instant' });
			return false;
		}

		let userInterrupted = false;

		const onUserScrollInput = (event: Event) => {
			// Detect user interaction that cancels restoration
			if (event.type === 'keydown') {
				const keyEvent = event as KeyboardEvent;
				const scrollKeys = [
					'ArrowUp',
					'ArrowDown',
					'PageUp',
					'PageDown',
					'Home',
					'End',
					'Space',
					' '
				];
				if (!scrollKeys.includes(keyEvent.key)) {
					return;
				}
			}
			userInterrupted = true;
		};

		const abortEvents: (keyof WindowEventMap)[] = ['wheel', 'touchstart', 'keydown'];
		for (const evt of abortEvents) {
			window.addEventListener(evt, onUserScrollInput, { passive: true });
		}

		isRestoringScroll = true;

		try {
			if (whenSettled) {
				await whenSettled;
			}

			if (userInterrupted) {
				return false;
			}

			// Perform instant restoration
			window.scrollTo({ top: snapshot.top, behavior: 'instant' });
			liveScrollTop = snapshot.top;
			return true;
		} finally {
			isRestoringScroll = false;
			for (const evt of abortEvents) {
				window.removeEventListener(evt, onUserScrollInput);
			}
		}
	} finally {
		savingEnabled = true;
	}
}

/**
 * Returns whether scroll restoration is currently active.
 */
export function getIsRestoringScroll(): boolean {
	return isRestoringScroll;
}

/**
 * Returns the currently active scroll key.
 */
export function getActiveKey(): string | null {
	return activeKey;
}

/**
 * Returns whether scroll position saving is currently enabled.
 */
export function getSavingEnabled(): boolean {
	return savingEnabled;
}

/**
 * Initialises global scroll position tracking listeners.
 */
export function initScrollRestorer(): () => void {
	if (restorerInitialized) {
		return cleanupRestorer ?? (() => {});
	}

	if (typeof window === 'undefined') {
		return () => {};
	}

	restorerInitialized = true;

	const onScroll = () => {
		liveScrollTop = window.scrollY || document.documentElement?.scrollTop || 0;
		if (activeKey !== null && savingEnabled && !isRestoringScroll) {
			recordCurrentScroll(activeKey);
		}
	};

	window.addEventListener('scroll', onScroll, { passive: true });

	cleanupRestorer = () => {
		window.removeEventListener('scroll', onScroll);
		restorerInitialized = false;
		cleanupRestorer = undefined;
	};

	return cleanupRestorer;
}

/**
 * Stops scroll tracking listeners.
 */
export function stopScrollRestorer(): void {
	if (cleanupRestorer) {
		cleanupRestorer();
	}
	restorerInitialized = false;
	liveScrollTop = 0;
	isRestoringScroll = false;
	activeKey = null;
	savingEnabled = false;
}
