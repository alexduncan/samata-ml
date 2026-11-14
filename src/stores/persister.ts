import { $appState } from './app.store';
import { $scrollState } from './scroll.store';
import { parseRoute } from '../router/route-parser';
import {
	INITIAL_APP_STATE,
	INITIAL_SCROLL_STATE,
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY,
	STORAGE_VERSION,
	type PersistedAppState,
	type PersistedScroll
} from '../types/state';

/**
 * Result of reading both persisted blobs; invalid or unsupported blobs come back as defaults.
 */
export interface PersistedRead {
	/** Validated application state or default state. */
	state: PersistedAppState;
	/** Validated scroll snapshot dictionary or default state. */
	scroll: PersistedScroll;
}

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

/** Set of storage keys permanently in read-only mode for this document. */
const readOnlyKeys = new Set<string>();

/**
 * Returns the currently active storage adapter.
 */
export function getActiveStorage(): StorageAdapter {
	return activeStorage;
}

const VALID_COLUMN_TYPES = new Set<string>([
	'numeric',
	'categorical',
	'boolean',
	'datetime',
	'text'
]);

const VALID_MODEL_STATUSES = new Set<string>(['draft', 'training', 'trained']);

const VALID_MODEL_SECTION_IDS = new Set<string>([
	'choose-model',
	'select-features',
	'configure-model',
	'configure-training',
	'training',
	'results'
]);

const VALID_MULTICLASS_STRATEGIES = new Set<string>(['native', 'one-vs-rest', 'one-vs-one']);

const VALID_TRAINING_SETUP_TYPES = new Set<string>(['nested_cv', 'k_fold_cv', 'train_test_split']);

const VALID_ERROR_CODES = new Set<string>([
	'TRAINING_FAILED',
	'TRAINING_CANCELLED',
	'TRAINING_INTERRUPTED_BY_RELOAD'
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateAppState(
	val: unknown
): { valid: true; state: PersistedAppState } | { valid: false; isNewer: boolean } {
	if (!isPlainObject(val)) {
		return { valid: false, isNewer: false };
	}

	if (typeof val.version === 'number' && val.version > STORAGE_VERSION) {
		return { valid: false, isNewer: true };
	}

	if (val.version !== STORAGE_VERSION) {
		return { valid: false, isNewer: false };
	}

	if (typeof val.updatedAt !== 'number' || !Number.isFinite(val.updatedAt)) {
		return { valid: false, isNewer: false };
	}

	if (!isPlainObject(val.onboarding) || typeof val.onboarding.welcomeDismissed !== 'boolean') {
		return { valid: false, isNewer: false };
	}

	if (typeof val.resumePath !== 'string' || parseRoute(val.resumePath).kind !== 'workflow') {
		return { valid: false, isNewer: false };
	}

	if (
		typeof val.nextModelNum !== 'number' ||
		!Number.isInteger(val.nextModelNum) ||
		val.nextModelNum < 1
	) {
		return { valid: false, isNewer: false };
	}

	if (!isPlainObject(val.results) || !isPlainObject(val.results.ui)) {
		return { valid: false, isNewer: false };
	}

	if (val.dataset !== null) {
		if (!isPlainObject(val.dataset)) {
			return { valid: false, isNewer: false };
		}
		if (typeof val.dataset.id !== 'string' || typeof val.dataset.name !== 'string') {
			return { valid: false, isNewer: false };
		}
		if (val.dataset.source !== 'sample' && val.dataset.source !== 'upload') {
			return { valid: false, isNewer: false };
		}
		if (
			val.dataset.sampleId !== undefined &&
			(typeof val.dataset.sampleId !== 'string' || val.dataset.sampleId.length === 0)
		) {
			return { valid: false, isNewer: false };
		}
		if (
			typeof val.dataset.rowCount !== 'number' ||
			!Number.isInteger(val.dataset.rowCount) ||
			val.dataset.rowCount < 0
		) {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(val.dataset.columns)) {
			return { valid: false, isNewer: false };
		}
		for (const col of val.dataset.columns) {
			if (!isPlainObject(col)) {
				return { valid: false, isNewer: false };
			}
			if (typeof col.name !== 'string' || typeof col.type !== 'string') {
				return { valid: false, isNewer: false };
			}
			if (!VALID_COLUMN_TYPES.has(col.type)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof col.missingCount !== 'number' ||
				!Number.isInteger(col.missingCount) ||
				col.missingCount < 0
			) {
				return { valid: false, isNewer: false };
			}
		}
	}

	if (!isPlainObject(val.data)) {
		return { valid: false, isNewer: false };
	}
	if (val.data.mode !== 'select' && val.data.mode !== 'preview') {
		return { valid: false, isNewer: false };
	}
	if (val.data.selectedColumn !== null && typeof val.data.selectedColumn !== 'string') {
		return { valid: false, isNewer: false };
	}

	if (val.target !== null && typeof val.target !== 'string') {
		return { valid: false, isNewer: false };
	}

	if (!Array.isArray(val.models)) {
		return { valid: false, isNewer: false };
	}
	for (const m of val.models) {
		if (!isPlainObject(m)) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.num !== 'number' || !Number.isInteger(m.num) || m.num < 1) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.createdAt !== 'number' || !Number.isFinite(m.createdAt)) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.status !== 'string' || !VALID_MODEL_STATUSES.has(m.status)) {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(m.completedSteps)) {
			return { valid: false, isNewer: false };
		}
		for (const step of m.completedSteps) {
			if (typeof step !== 'string' || !VALID_MODEL_SECTION_IDS.has(step)) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.modelId !== null && typeof m.modelId !== 'string') {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(m.features) || !m.features.every((f) => typeof f === 'string')) {
			return { valid: false, isNewer: false };
		}
		if (!isPlainObject(m.modelOptions) || !isPlainObject(m.ui)) {
			return { valid: false, isNewer: false };
		}
		if (!isPlainObject(m.hyperparameters)) {
			return { valid: false, isNewer: false };
		}
		if (m.hyperparameters.mode !== 'manual' && m.hyperparameters.mode !== 'tuning') {
			return { valid: false, isNewer: false };
		}
		if (!isPlainObject(m.hyperparameters.values)) {
			return { valid: false, isNewer: false };
		}
		if (
			m.hyperparameters.tuningSearchSpace !== undefined &&
			!isPlainObject(m.hyperparameters.tuningSearchSpace)
		) {
			return { valid: false, isNewer: false };
		}
		if (
			m.multiclass !== null &&
			(typeof m.multiclass !== 'string' || !VALID_MULTICLASS_STRATEGIES.has(m.multiclass))
		) {
			return { valid: false, isNewer: false };
		}
		if (m.trainingSetup !== null) {
			if (!isPlainObject(m.trainingSetup)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.trainingSetup.type !== 'string' ||
				!VALID_TRAINING_SETUP_TYPES.has(m.trainingSetup.type)
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.progress !== null) {
			if (!isPlainObject(m.progress)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.progress.percent !== 'number' ||
				!Number.isFinite(m.progress.percent) ||
				typeof m.progress.statusMessage !== 'string'
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.error !== null) {
			if (!isPlainObject(m.error)) {
				return { valid: false, isNewer: false };
			}
			if (typeof m.error.code !== 'string' || !VALID_ERROR_CODES.has(m.error.code)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.error.message !== 'string' ||
				typeof m.error.timestamp !== 'number' ||
				!Number.isFinite(m.error.timestamp)
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.timings !== null && !isPlainObject(m.timings)) {
			return { valid: false, isNewer: false };
		}
		if (
			m.durationMs !== null &&
			(typeof m.durationMs !== 'number' || !Number.isFinite(m.durationMs))
		) {
			return { valid: false, isNewer: false };
		}
		if (m.metrics !== null && !isPlainObject(m.metrics)) {
			return { valid: false, isNewer: false };
		}
	}

	return { valid: true, state: val as unknown as PersistedAppState };
}

function validateScrollState(
	val: unknown
): { valid: true; scroll: PersistedScroll } | { valid: false; isNewer: boolean } {
	if (!isPlainObject(val)) {
		return { valid: false, isNewer: false };
	}

	if (typeof val.version === 'number' && val.version > STORAGE_VERSION) {
		return { valid: false, isNewer: true };
	}

	if (val.version !== STORAGE_VERSION) {
		return { valid: false, isNewer: false };
	}

	if (!isPlainObject(val.snapshots)) {
		return { valid: false, isNewer: false };
	}

	for (const snap of Object.values(val.snapshots)) {
		if (!isPlainObject(snap)) {
			return { valid: false, isNewer: false };
		}
		if (
			typeof snap.viewportWidth !== 'number' ||
			!Number.isFinite(snap.viewportWidth) ||
			typeof snap.top !== 'number' ||
			!Number.isFinite(snap.top) ||
			typeof snap.savedAt !== 'number' ||
			!Number.isFinite(snap.savedAt)
		) {
			return { valid: false, isNewer: false };
		}
		if (snap.regions !== undefined) {
			if (!isPlainObject(snap.regions)) {
				return { valid: false, isNewer: false };
			}
			for (const region of Object.values(snap.regions)) {
				if (!isPlainObject(region)) {
					return { valid: false, isNewer: false };
				}
				if (
					typeof region.top !== 'number' ||
					!Number.isFinite(region.top) ||
					typeof region.left !== 'number' ||
					!Number.isFinite(region.left)
				) {
					return { valid: false, isNewer: false };
				}
			}
		}
	}

	return { valid: true, scroll: val as unknown as PersistedScroll };
}

/**
 * Reads and validates both keys. Marks a key read-only for this document if its version is newer than STORAGE_VERSION.
 *
 * @param storage - Custom StorageAdapter (defaults to active storage).
 * @returns Validated persisted state and scroll snapshots, or defaults.
 */
export function readPersistedState(storage?: StorageAdapter): PersistedRead {
	if (storage && storage !== activeStorage) {
		readOnlyKeys.clear();
		activeStorage = storage;
	}
	const s = storage ?? activeStorage;

	let state = { ...INITIAL_APP_STATE };
	const rawState = s.getItem(STATE_STORAGE_KEY);
	if (rawState) {
		try {
			const parsed = JSON.parse(rawState);
			const result = validateAppState(parsed);
			if (result.valid) {
				state = result.state;
			} else if (result.isNewer) {
				readOnlyKeys.add(STATE_STORAGE_KEY);
			}
		} catch {
			// Malformed JSON yields defaults
		}
	}

	let scroll = { ...INITIAL_SCROLL_STATE };
	const rawScroll = s.getItem(SCROLL_STORAGE_KEY);
	if (rawScroll) {
		try {
			const parsed = JSON.parse(rawScroll);
			const result = validateScrollState(parsed);
			if (result.valid) {
				scroll = result.scroll;
			} else if (result.isNewer) {
				readOnlyKeys.add(SCROLL_STORAGE_KEY);
			}
		} catch {
			// Malformed JSON yields defaults
		}
	}

	return { state, scroll };
}

let unbindAppState: (() => void) | undefined;
let unbindScrollState: (() => void) | undefined;

let pendingStateTimer: ReturnType<typeof setTimeout> | undefined;
let pendingProgressTimer: ReturnType<typeof setTimeout> | undefined;
let pendingScrollTimer: ReturnType<typeof setTimeout> | undefined;

let previousAppState: PersistedAppState | undefined;

/**
 * Safely writes a key/value pair to storage, catching QuotaExceededError by clearing scroll snapshots and retrying.
 */
function safeSetItem(storage: StorageAdapter, key: string, value: string): void {
	if (readOnlyKeys.has(key)) {
		return;
	}
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
 * Options configuring debounce and throttle durations for persister.
 */
export interface PersisterOptions {
	/** Debounce duration in milliseconds for scroll snapshots. Defaults to 150 ms. */
	debounceScrollMs?: number;
	/** Debounce duration in milliseconds for field edits. Defaults to 300 ms. */
	debounceFieldMs?: number;
	/** Throttle duration in milliseconds for training progress updates. Defaults to 1000 ms. */
	throttleProgressMs?: number;
}

/**
 * Writes current app state synchronously to storage.
 */
function writeAppStateNow(storage: StorageAdapter, state: PersistedAppState): void {
	if (pendingStateTimer !== undefined) {
		clearTimeout(pendingStateTimer);
		pendingStateTimer = undefined;
	}
	if (pendingProgressTimer !== undefined) {
		clearTimeout(pendingProgressTimer);
		pendingProgressTimer = undefined;
	}
	if (readOnlyKeys.has(STATE_STORAGE_KEY)) {
		return;
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
	if (readOnlyKeys.has(SCROLL_STORAGE_KEY)) {
		return;
	}
	safeSetItem(storage, SCROLL_STORAGE_KEY, JSON.stringify(scroll));
}

/**
 * Writes $appState and $scrollState now, cancelling pending timers; skips read-only keys.
 *
 * @param storage - Custom StorageAdapter (defaults to active storage).
 */
export function persistNow(storage?: StorageAdapter): void {
	const s = storage ?? activeStorage;
	if (pendingStateTimer !== undefined) {
		clearTimeout(pendingStateTimer);
		pendingStateTimer = undefined;
	}
	if (pendingProgressTimer !== undefined) {
		clearTimeout(pendingProgressTimer);
		pendingProgressTimer = undefined;
	}
	if (pendingScrollTimer !== undefined) {
		clearTimeout(pendingScrollTimer);
		pendingScrollTimer = undefined;
	}
	if (!readOnlyKeys.has(STATE_STORAGE_KEY)) {
		safeSetItem(s, STATE_STORAGE_KEY, JSON.stringify($appState.get()));
	}
	if (!readOnlyKeys.has(SCROLL_STORAGE_KEY)) {
		safeSetItem(s, SCROLL_STORAGE_KEY, JSON.stringify($scrollState.get()));
	}
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

	// Check per-model changes
	for (let i = 0; i < next.models.length; i++) {
		const prevModel = prev.models[i];
		const nextModel = next.models[i];
		if (!prevModel || !nextModel) return true;
		if (prevModel.num !== nextModel.num) return true;
		if (prevModel.status !== nextModel.status) return true;
		if (
			prevModel.completedSteps.length !== nextModel.completedSteps.length ||
			prevModel.completedSteps.some((step, idx) => step !== nextModel.completedSteps[idx])
		) {
			return true;
		}
		if (prevModel.modelId !== nextModel.modelId) return true;
		if (prevModel.error !== nextModel.error) return true;

		// Discrete selections: synchronous per D4
		if (prevModel.multiclass !== nextModel.multiclass) return true;
		if (prevModel.hyperparameters.mode !== nextModel.hyperparameters.mode) return true;
		if (prevModel.trainingSetup?.type !== nextModel.trainingSetup?.type) return true;

		// features differs (any order)
		if (prevModel.features.length !== nextModel.features.length) return true;
		const prevFeatures = new Set(prevModel.features);
		if (nextModel.features.some((f) => !prevFeatures.has(f))) return true;
	}

	return false;
}

/**
 * Determines whether an app state change modifies only model training progress.
 */
function isProgressOnlyChange(
	prev: PersistedAppState | undefined,
	next: PersistedAppState
): boolean {
	if (!prev) return false;

	if (
		prev.version !== next.version ||
		prev.onboarding.welcomeDismissed !== next.onboarding.welcomeDismissed ||
		prev.resumePath !== next.resumePath ||
		prev.dataset !== next.dataset ||
		prev.data.mode !== next.data.mode ||
		prev.data.selectedColumn !== next.data.selectedColumn ||
		prev.target !== next.target ||
		prev.nextModelNum !== next.nextModelNum ||
		prev.results !== next.results ||
		prev.models.length !== next.models.length
	) {
		return false;
	}

	for (let i = 0; i < next.models.length; i++) {
		const prevModel = prev.models[i];
		const nextModel = next.models[i];
		if (!prevModel || !nextModel) return false;
		if (
			prevModel.num !== nextModel.num ||
			prevModel.createdAt !== nextModel.createdAt ||
			prevModel.status !== nextModel.status ||
			prevModel.completedSteps !== nextModel.completedSteps ||
			prevModel.modelId !== nextModel.modelId ||
			prevModel.features !== nextModel.features ||
			prevModel.modelOptions !== nextModel.modelOptions ||
			prevModel.hyperparameters !== nextModel.hyperparameters ||
			prevModel.multiclass !== nextModel.multiclass ||
			prevModel.trainingSetup !== nextModel.trainingSetup ||
			prevModel.error !== nextModel.error ||
			prevModel.timings !== nextModel.timings ||
			prevModel.durationMs !== nextModel.durationMs ||
			prevModel.metrics !== nextModel.metrics ||
			prevModel.ui !== nextModel.ui
		) {
			return false;
		}
	}

	return true;
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
	if (pendingProgressTimer !== undefined) {
		clearTimeout(pendingProgressTimer);
		pendingProgressTimer = undefined;
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
 * @param options - Debounce durations for field edits and scroll snapshots, and progress throttle duration.
 */
export function initPersister(storage?: StorageAdapter, options: PersisterOptions = {}): void {
	stopPersister();

	if (storage && storage !== activeStorage) {
		readOnlyKeys.clear();
		activeStorage = storage;
	}

	const debounceScrollMs = options.debounceScrollMs ?? 150;
	const debounceFieldMs = options.debounceFieldMs ?? 300;
	const throttleProgressMs = options.throttleProgressMs ?? 1000;

	previousAppState = $appState.get();

	unbindAppState = $appState.subscribe((nextState) => {
		const sync = isSynchronousChange(previousAppState, nextState);
		const progressOnly = !sync && isProgressOnlyChange(previousAppState, nextState);
		previousAppState = nextState;

		if (sync) {
			if (pendingStateTimer !== undefined) {
				clearTimeout(pendingStateTimer);
				pendingStateTimer = undefined;
			}
			if (pendingProgressTimer !== undefined) {
				clearTimeout(pendingProgressTimer);
				pendingProgressTimer = undefined;
			}
			writeAppStateNow(activeStorage, nextState);
		} else if (progressOnly) {
			if (pendingStateTimer !== undefined) {
				clearTimeout(pendingStateTimer);
				pendingStateTimer = undefined;
			}
			if (pendingProgressTimer === undefined) {
				pendingProgressTimer = setTimeout(() => {
					pendingProgressTimer = undefined;
					writeAppStateNow(activeStorage, $appState.get());
				}, throttleProgressMs);
			}
		} else {
			if (pendingProgressTimer !== undefined) {
				clearTimeout(pendingProgressTimer);
				pendingProgressTimer = undefined;
			}
			if (pendingStateTimer !== undefined) {
				clearTimeout(pendingStateTimer);
			}
			pendingStateTimer = setTimeout(() => {
				pendingStateTimer = undefined;
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
