import { atom } from 'nanostores';
import { INITIAL_SCROLL_STATE, type PersistedScroll, type ScrollSnapshot } from '../types/state';

/**
 * Nanostore holding view and document scroll snapshots.
 * Follows specification/state-and-storage.md §2 and §3.
 */
export const $scrollState = atom<PersistedScroll>(INITIAL_SCROLL_STATE);

/**
 * Records or updates a scroll snapshot for a specific route or view key.
 *
 * @param key - View or route key (e.g. 'data:select', 'target', 'models', 'models/1').
 * @param snapshot - Scroll offset and viewport metadata.
 */
export function recordScroll(key: string, snapshot: ScrollSnapshot): void {
	const current = $scrollState.get();
	$scrollState.set({
		...current,
		snapshots: {
			...current.snapshots,
			[key]: snapshot
		}
	});
}

/**
 * Clears scroll snapshots for specific keys or all keys if none specified.
 *
 * @param keys - Optional list of keys to remove. If omitted, clears all snapshots.
 */
export function clearScroll(keys?: string[]): void {
	const current = $scrollState.get();
	if (!keys || keys.length === 0) {
		$scrollState.set({
			...current,
			snapshots: {}
		});
		return;
	}

	const remaining: Record<string, ScrollSnapshot> = {};
	const removeSet = new Set(keys);
	for (const [k, v] of Object.entries(current.snapshots)) {
		if (!removeSet.has(k)) {
			remaining[k] = v;
		}
	}

	$scrollState.set({
		...current,
		snapshots: remaining
	});
}
