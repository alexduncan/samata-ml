import { $appState } from './app.store';
import { $scrollState } from './scroll.store';
import {
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY,
	type PersistedAppState,
	type PersistedScroll
} from '../types/state';

/**
 * Storage adapter abstraction for localStorage and test mocks.
 */
export interface StorageAdapter {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/**
 * In-memory fallback storage for environments without localStorage.
 */
export class MemoryStorage implements StorageAdapter {
	private readonly data = new Map<string, string>();

	getItem(key: string): string | null {
		return this.data.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}

	removeItem(key: string): void {
		this.data.delete(key);
	}

	clear(): void {
		this.data.clear();
	}
}

let activeStorage: StorageAdapter =
	typeof window !== 'undefined' && window.localStorage
		? window.localStorage
		: new MemoryStorage();

/**
 * Returns the currently active storage adapter.
 */
export function getActiveStorage(): StorageAdapter {
	return activeStorage;
}

let unbindAppState: (() => void) | undefined;
let unbindScrollState: (() => void) | undefined;

let pendingStateTimer: ReturnType<typeof setTimeout> | undefined;
let pendingScrollTimer: ReturnType<typeof setTimeout> | undefined;

let previousAppState: PersistedAppState | undefined;

/**
 * Safely writes a key/value pair to storage, catching QuotaExceededError by clearing scroll snapshots and retrying.
 */
function safeSetItem(storage: StorageAdapter, key: string, value: string): void {
	try {
		storage.setItem(key, value);
	} catch (err: unknown) {
		const isQuota =
			err instanceof Error &&
			(err.name === 'QuotaExceededError' ||
				err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
				err.message.toLowerCase().includes('quota'));

		if (isQuota) {
			try {
				storage.removeItem(SCROLL_STORAGE_KEY);
				storage.setItem(key, value);
				console.warn('Storage quota exceeded: purged scroll snapshots and retried write.');
			} catch (retryErr) {
				console.error('Storage quota exceeded permanently:', retryErr);
			}
		} else {
			console.error('Failed to write to storage:', err);
		}
	}
}

/**
 * Writes current app state synchronously to storage.
 */
function writeAppStateNow(storage: StorageAdapter, state: PersistedAppState): void {
	if (pendingStateTimer !== undefined) {
		clearTimeout(pendingStateTimer);
		pendingStateTimer = undefined;
	}
	safeSetItem(storage, STATE_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Writes current scroll state synchronously to storage.
 */
function writeScrollStateNow(storage: StorageAdapter, scroll: PersistedScroll): void {
	if (pendingScrollTimer !== undefined) {
		clearTimeout(pendingScrollTimer);
		pendingScrollTimer = undefined;
	}
	safeSetItem(storage, SCROLL_STORAGE_KEY, JSON.stringify(scroll));
}

/**
 * Determines whether an app state change requires immediate synchronous persistence.
 */
function isSynchronousChange(
	prev: PersistedAppState | undefined,
	next: PersistedAppState
): boolean {
	if (!prev) return true;

	if (prev.resumePath !== next.resumePath) return true;
	if (prev.dataset !== next.dataset) return true;
	if (prev.target !== next.target) return true;
	if (prev.onboarding.welcomeDismissed !== next.onboarding.welcomeDismissed) return true;
	if (prev.data.mode !== next.data.mode) return true;
	if (prev.data.selectedColumn !== next.data.selectedColumn) return true;
	if (prev.models.length !== next.models.length) return true;

	// Check per-model status and completedSteps changes
	for (let i = 0; i < next.models.length; i++) {
		const prevModel = prev.models[i];
		const nextModel = next.models[i];
		if (!prevModel || !nextModel) return true;
		if (prevModel.status !== nextModel.status) return true;
		if (prevModel.completedSteps.length !== nextModel.completedSteps.length) return true;
		if (prevModel.modelId !== nextModel.modelId) return true;
		if (prevModel.error !== nextModel.error) return true;
	}

	return false;
}

/**
 * Flushes all pending debounced writes immediately.
 */
export function flushNow(): void {
	if (pendingStateTimer !== undefined) {
		clearTimeout(pendingStateTimer);
		pendingStateTimer = undefined;
		writeAppStateNow(activeStorage, $appState.get());
	}
	if (pendingScrollTimer !== undefined) {
		clearTimeout(pendingScrollTimer);
		pendingScrollTimer = undefined;
		writeScrollStateNow(activeStorage, $scrollState.get());
	}
}

/**
 * Initializes persistence listeners on $appState and $scrollState.
 *
 * @param storage - Custom StorageAdapter (defaults to window.localStorage or MemoryStorage).
 * @param options - Debounce durations for field edits and scroll snapshots.
 */
export function initPersister(
	storage?: StorageAdapter,
	options: { debounceScrollMs?: number; debounceFieldMs?: number } = {}
): void {
	stopPersister();

	if (storage) {
		activeStorage = storage;
	}

	const debounceScrollMs = options.debounceScrollMs ?? 150;
	const debounceFieldMs = options.debounceFieldMs ?? 300;

	previousAppState = $appState.get();

	unbindAppState = $appState.subscribe((nextState) => {
		const sync = isSynchronousChange(previousAppState, nextState);
		previousAppState = nextState;

		if (sync) {
			writeAppStateNow(activeStorage, nextState);
		} else {
			if (pendingStateTimer !== undefined) {
				clearTimeout(pendingStateTimer);
			}
			pendingStateTimer = setTimeout(() => {
				writeAppStateNow(activeStorage, $appState.get());
			}, debounceFieldMs);
		}
	});

	unbindScrollState = $scrollState.subscribe((nextScroll) => {
		if (pendingScrollTimer !== undefined) {
			clearTimeout(pendingScrollTimer);
		}
		pendingScrollTimer = setTimeout(() => {
			writeScrollStateNow(activeStorage, nextScroll);
		}, debounceScrollMs);
	});

	// Register lifecycle listeners in browser environment
	if (typeof window !== 'undefined' && typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				flushNow();
			}
		});
		window.addEventListener('pagehide', () => {
			flushNow();
		});
	}
}

/**
 * Disconnects persistence listeners and flushes pending writes.
 */
export function stopPersister(): void {
	flushNow();
	if (unbindAppState) {
		unbindAppState();
		unbindAppState = undefined;
	}
	if (unbindScrollState) {
		unbindScrollState();
		unbindScrollState = undefined;
	}
}
