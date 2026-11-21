import { atom } from 'nanostores';
import { $appState } from './app.store';
import { $scrollState } from './scroll.store';
import { parseRoute } from '../router/route-parser';
import { openSamataDb } from '../common/storage/db';
import {
	clearPendingTrainingCheckpoint,
	commitTrainingCheckpoint,
	decodeProtectedDomain,
	readTrainingCheckpoint,
	storageFailure,
	type PendingTrainingDomain,
	type PersistenceFailure,
	type TrainingDomainCheckpoint,
	type TrainingDomainMutation,
	type TrainingSetupDecodeOutcome
} from '../common/storage/training-domain';
import {
	INITIAL_APP_STATE,
	INITIAL_SCROLL_STATE,
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY,
	STORAGE_VERSION,
	type ModelRecord,
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
	/** Transient decode outcomes aligned with the original model array. */
	trainingSetupDecodeOutcomes: readonly TrainingSetupDecodeOutcome[];
	/** Failed domain read, distinct from a missing snapshot. */
	domainFailure?: PersistenceFailure;
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
	typeof window === 'undefined'
		? new MemoryStorage()
		: {
				getItem: (key) => window.localStorage.getItem(key),
				setItem: (key, value) => window.localStorage.setItem(key, value),
				removeItem: (key) => window.localStorage.removeItem(key)
			};

const readOnlyKeys = new WeakMap<StorageAdapter, Set<string>>();

function markReadOnly(storage: StorageAdapter, key: string): void {
	const keys = readOnlyKeys.get(storage) ?? new Set<string>();
	keys.add(key);
	readOnlyKeys.set(storage, keys);
}

/**
 * Returns the currently active storage adapter.
 */
export function getActiveStorage(): StorageAdapter {
	return activeStorage;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Writes application state with v1 tags without mutating in-memory model setups. */
function serialiseAppState(state: PersistedAppState): string {
	return JSON.stringify({
		...state,
		models: state.models.map((model) =>
			model.trainingSetup?.type === 'one_shot'
				? { ...model, trainingSetup: { ...model.trainingSetup, type: 'train_test_split' } }
				: model
		)
	});
}

function validateAppState(val: unknown):
	| {
			valid: true;
			state: PersistedAppState;
			trainingSetupDecodeOutcomes: readonly TrainingSetupDecodeOutcome[];
	  }
	| { valid: false; isNewer: boolean } {
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

	if (!isPlainObject(val.results) || !isPlainObject(val.results.ui)) {
		return { valid: false, isNewer: false };
	}
	const generation =
		val.trainingDomainGeneration === undefined ? 0 : val.trainingDomainGeneration;
	if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 0) {
		return { valid: false, isNewer: false };
	}
	const decoded = decodeProtectedDomain(val);
	if (!decoded) return { valid: false, isNewer: false };
	return {
		valid: true,
		state: {
			...val,
			...decoded.domain,
			trainingDomainGeneration: generation
		} as PersistedAppState,
		trainingSetupDecodeOutcomes: decoded.trainingSetupDecodeOutcomes
	};
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
		activeStorage = storage;
	}
	const s = storage ?? activeStorage;

	const app = readAppSnapshot(s);

	let scroll = { ...INITIAL_SCROLL_STATE };
	try {
		const rawScroll = s.getItem(SCROLL_STORAGE_KEY);
		if (rawScroll) {
			const parsed = JSON.parse(rawScroll);
			const result = validateScrollState(parsed);
			if (result.valid) {
				scroll = result.scroll;
			} else if (result.isNewer) {
				markReadOnly(s, SCROLL_STORAGE_KEY);
			}
		}
	} catch {
		// Scroll restoration is best effort.
	}

	return {
		state: app.ok && app.state ? app.state : { ...INITIAL_APP_STATE },
		scroll,
		trainingSetupDecodeOutcomes: app.ok ? app.trainingSetupDecodeOutcomes : [],
		...(!app.ok && { domainFailure: app })
	};
}

/** Reads the current v1 domain and distinguishes absence, unsupported versions and read failures. */
export function readAppSnapshot(storage = activeStorage):
	| {
			ok: true;
			state: PersistedAppState | null;
			trainingSetupDecodeOutcomes: readonly TrainingSetupDecodeOutcome[];
	  }
	| PersistenceFailure {
	if (readOnlyKeys.get(storage)?.has(STATE_STORAGE_KEY))
		return { ok: false, reason: 'read-only' };
	try {
		const raw = storage.getItem(STATE_STORAGE_KEY);
		if (raw === null) return { ok: true, state: null, trainingSetupDecodeOutcomes: [] };
		const decoded = validateAppState(JSON.parse(raw));
		if (decoded.valid) {
			return {
				ok: true,
				state: decoded.state,
				trainingSetupDecodeOutcomes: decoded.trainingSetupDecodeOutcomes
			};
		}
		if (decoded.isNewer) {
			markReadOnly(storage, STATE_STORAGE_KEY);
			return { ok: false, reason: 'read-only' };
		}
		return { ok: false, reason: 'unavailable' };
	} catch (error) {
		return storageFailure(error);
	}
}

let unbindAppState: (() => void) | undefined;
let unbindScrollState: (() => void) | undefined;

let pendingStateTimer: ReturnType<typeof setTimeout> | undefined;
let pendingProgressTimer: ReturnType<typeof setTimeout> | undefined;
let pendingScrollTimer: ReturnType<typeof setTimeout> | undefined;

let previousAppState: PersistedAppState | undefined;
let publishingSnapshot = false;
let protectedPersistence: TrainingPersistenceOptions | undefined;
let ordinaryBase: PersistedAppState | undefined;
let acknowledgedState: PersistedAppState | undefined;
let unbindLifecycle: (() => void) | undefined;

type TrainingLogEdit = {
	datasetId: string | undefined;
	target: string | null;
	createdAt: number;
	open: boolean;
};

// Ordinary writes consume ordinaryBase when they are queued. Keep local disclosure edits
// until a write acknowledges them or publication replaces their model context.
const trainingLogEdits = new Map<number, TrainingLogEdit>();

function recordTrainingLogEdits(previous: PersistedAppState, next: PersistedAppState): void {
	if (previous.dataset?.id !== next.dataset?.id || previous.target !== next.target) {
		trainingLogEdits.clear();
		return;
	}
	if (previous.models === next.models) return;
	pruneTrainingLogEdits(next);
	for (const model of next.models) {
		const before = previous.models.find(
			(entry) => entry.num === model.num && entry.createdAt === model.createdAt
		);
		const open = model.ui.trainingLogOpen ?? false;
		if (before && open !== (before.ui.trainingLogOpen ?? false)) {
			trainingLogEdits.set(model.num, {
				datasetId: next.dataset?.id,
				target: next.target,
				createdAt: model.createdAt,
				open
			});
		}
	}
}

function findTrainingLogEdit(
	state: PersistedAppState,
	model: ModelRecord
): TrainingLogEdit | undefined {
	const edit = trainingLogEdits.get(model.num);
	if (
		edit &&
		edit.datasetId === state.dataset?.id &&
		edit.target === state.target &&
		edit.createdAt === model.createdAt
	) {
		return edit;
	}
}

function pruneTrainingLogEdits(state: PersistedAppState, acknowledgeMatches = false): void {
	for (const [num, edit] of trainingLogEdits) {
		const model = state.models.find((entry) => entry.num === num);
		if (
			!model ||
			!findTrainingLogEdit(state, model) ||
			(acknowledgeMatches && edit.open === (model.ui.trainingLogOpen ?? false))
		) {
			trainingLogEdits.delete(num);
		}
	}
}

function mergeTrainingLogEdit(state: PersistedAppState, model: ModelRecord): ModelRecord {
	const edit = findTrainingLogEdit(state, model);
	if (!edit || edit.open === (model.ui.trainingLogOpen ?? false)) return model;
	return { ...model, ui: { ...model.ui, trainingLogOpen: edit.open } };
}

function mergeTrainingLogEdits(state: PersistedAppState): PersistedAppState {
	if (!trainingLogEdits.size) return state;
	const models = state.models.map((model) => mergeTrainingLogEdit(state, model));
	return models.some((model, index) => model !== state.models[index])
		? { ...state, models }
		: state;
}

/** A best-effort write failed and the current tab's edits remain available in memory. */
export const $storageSaveNotice = atom<PersistenceFailure | null>(null);

function noteOrdinaryFailure(ack: { ok: true } | PersistenceFailure): void {
	if (!ack.ok && !$storageSaveNotice.get()) $storageSaveNotice.set(ack);
}

/**
 * Safely writes a key/value pair to storage, catching QuotaExceededError by clearing scroll snapshots and retrying.
 */
function safeSetItem(
	storage: StorageAdapter,
	key: string,
	value: string
): { ok: true } | PersistenceFailure {
	if (readOnlyKeys.get(storage)?.has(key)) {
		return { ok: false, reason: 'read-only' };
	}
	try {
		storage.setItem(key, value);
		return { ok: true };
	} catch (error) {
		const failure = storageFailure(error);
		if (failure.reason === 'quota') {
			try {
				storage.removeItem(SCROLL_STORAGE_KEY);
				storage.setItem(key, value);
				return { ok: true };
			} catch (retryError) {
				return storageFailure(retryError);
			}
		}
		return failure;
	}
}

/** Acknowledgement of protected localStorage publication. */
export type PersistenceAck = { ok: true; generation: number } | PersistenceFailure;

/** Short lock serialising every read or publication of the protected training state. */
export const TRAINING_STATE_LOCK = 'samata-ml:training-state';

/** Storage and lock seams used by the app and deterministic tests. */
export interface TrainingPersistenceOptions {
	storage?: StorageAdapter;
	openDb?: typeof openSamataDb;
	withStateLock?: <T>(operation: () => Promise<T>) => Promise<T>;
}

/** The connections owned by one state-lock callback. */
export type TrainingStateContext = {
	db: Awaited<ReturnType<typeof openSamataDb>>;
	storage: StorageAdapter;
};

/** Takes only the state lock. Resource locks must be acquired by the caller beforehand. */
export async function withTrainingStateLock<T>(
	operation: (context: TrainingStateContext) => Promise<T>,
	options: TrainingPersistenceOptions = {}
): Promise<T | PersistenceFailure> {
	const storage = options.storage ?? activeStorage;
	const request =
		options.withStateLock ??
		(typeof navigator !== 'undefined' && navigator.locks
			? <Value>(callback: () => Promise<Value>) =>
					navigator.locks.request(TRAINING_STATE_LOCK, callback)
			: null);
	if (!request) return { ok: false, reason: 'unavailable' };
	try {
		return await request(async () => {
			const db = await (options.openDb ?? openSamataDb)();
			try {
				return await operation({ db, storage });
			} finally {
				db.close();
			}
		});
	} catch (error) {
		return storageFailure(error);
	}
}

/** Applies a validated snapshot under the state lock, retaining unsaved edits to matching logs. */
export function publishAcknowledgedAppSnapshot(state: PersistedAppState): void {
	acknowledgedState = state;
	pruneTrainingLogEdits(state);
	publishingSnapshot = true;
	try {
		$appState.set(mergeTrainingLogEdits(state));
	} finally {
		publishingSnapshot = false;
	}
}

function writeAcknowledgedSnapshot(
	storage: StorageAdapter,
	state: PersistedAppState
): PersistenceAck {
	const written = safeSetItem(storage, STATE_STORAGE_KEY, serialiseAppState(state));
	if (!written.ok) return written;
	pruneTrainingLogEdits(state, true);
	return { ok: true, generation: state.trainingDomainGeneration };
}

function saveTrainingLogEdits(
	storage: StorageAdapter,
	state: PersistedAppState,
	visible: PersistedAppState
): PersistedAppState {
	if (visible === state) {
		pruneTrainingLogEdits(state, true);
		return state;
	}
	// The protected state is already durable. Saving the disclosure remains best effort.
	const ack = writeAcknowledgedSnapshot(storage, visible);
	noteOrdinaryFailure(ack);
	return ack.ok ? visible : state;
}

async function publishPending(
	context: TrainingStateContext,
	checkpoint: TrainingDomainCheckpoint,
	current: PersistedAppState | null,
	firstPublication = false
): Promise<{ ok: true; state: PersistedAppState } | PersistenceFailure> {
	const pending = checkpoint.pending;
	if (!pending || (current?.trainingDomainGeneration ?? 0) > checkpoint.generation) {
		return { ok: false, reason: 'conflict' };
	}
	const acknowledged = current?.trainingDomainGeneration === checkpoint.generation;
	const candidate = acknowledged
		? current
		: {
				...(current ?? INITIAL_APP_STATE),
				...pending.domain,
				trainingDomainGeneration: checkpoint.generation,
				updatedAt: Date.now()
			};
	let state =
		!acknowledged && current
			? keepLocalOrdinaryChanges(candidate, current, firstPublication)
			: candidate;
	if (!acknowledged) {
		state = mergeTrainingLogEdits(state);
		const ack = writeAcknowledgedSnapshot(context.storage, state);
		if (!ack.ok) return ack;
		acknowledgedState = state;
	}
	const cleared = await clearPendingTrainingCheckpoint(
		context.db,
		checkpoint.generation,
		pending.operationId
	);
	if (!cleared.ok) return cleared;
	state = saveTrainingLogEdits(context.storage, state, mergeTrainingLogEdits(state));
	publishAcknowledgedAppSnapshot(state);
	return { ok: true, state };
}

/** Freshly validated localStorage state and the current durable fence. */
export type GuardedSnapshot = {
	ok: true;
	state: PersistedAppState | null;
	generation: number;
	trainingSetupDecodeOutcomes: readonly TrainingSetupDecodeOutcome[];
	replayed: boolean;
};

/** Reads the snapshot and fence under the state lock, replaying only an already committed candidate. */
export async function readGuardedTrainingSnapshot(
	context: TrainingStateContext
): Promise<GuardedSnapshot | PersistenceFailure> {
	const snapshot = readAppSnapshot(context.storage);
	if (!snapshot.ok) return snapshot;
	const stored = await readTrainingCheckpoint(context.db);
	if (!stored.ok) return stored;
	const checkpoint = stored.checkpoint;
	const generation = checkpoint?.generation ?? 0;
	if (checkpoint?.pending) {
		const replay = await publishPending(context, checkpoint, snapshot.state);
		return replay.ok
			? {
					ok: true,
					state: replay.state,
					generation,
					replayed: true,
					trainingSetupDecodeOutcomes: replay.state.models.map((model) =>
						model.trainingSetup ? 'valid' : 'explicit-null'
					)
				}
			: replay;
	}
	if (snapshot.state && snapshot.state.trainingDomainGeneration !== generation) {
		return { ok: false, reason: 'conflict' };
	}
	if (snapshot.state) pruneTrainingLogEdits(snapshot.state);
	return { ...snapshot, generation, replayed: false };
}

/** Applies a verified newer snapshot under the state lock, preserving current-tab preferences. */
export function publishNewerTrainingSnapshot(state: PersistedAppState): void {
	const current = $appState.get();
	if (state.trainingDomainGeneration > current.trainingDomainGeneration) {
		publishAcknowledgedAppSnapshot({
			...state,
			onboarding: current.onboarding,
			resumePath: current.resumePath,
			results: current.results
		});
	}
}

/** Applies a verified training outcome after foreign cleanup, with the state lock held. */
export function publishRecoveredTrainingSnapshot(
	context: TrainingStateContext,
	state: PersistedAppState,
	model: ModelRecord
): void {
	const edited = mergeTrainingLogEdit(state, model);
	const visible =
		edited === model
			? state
			: { ...state, models: state.models.map((entry) => (entry === model ? edited : entry)) };
	const saved = saveTrainingLogEdits(context.storage, state, visible);
	if (saved !== state) acknowledgedState = saved;
	publishNewerTrainingSnapshot(saved);
}

/** Refreshes a newer protected generation after a storage event, without echoing ordinary writes. */
export function refreshTrainingSnapshot(
	options?: TrainingPersistenceOptions
): Promise<PersistenceAck> {
	return withTrainingStateLock(async (context): Promise<PersistenceAck> => {
		const snapshot = await readGuardedTrainingSnapshot(context);
		if (!snapshot.ok) return snapshot;
		if (!snapshot.state) return { ok: false, reason: 'conflict' };
		publishNewerTrainingSnapshot(snapshot.state);
		return { ok: true, generation: snapshot.generation };
	}, options);
}

const draftFields = [
	'modelId',
	'features',
	'modelOptions',
	'hyperparameters',
	'multiclass',
	'trainingSetup'
] as const;

function draftSteps(model: ModelRecord) {
	return model.completedSteps.filter(
		(section) => section !== 'training' && section !== 'results'
	);
}

function sameDraft(left: ModelRecord, right: ModelRecord): boolean {
	return (
		draftFields.every(
			(field) => JSON.stringify(left[field]) === JSON.stringify(right[field])
		) && JSON.stringify(draftSteps(left)) === JSON.stringify(draftSteps(right))
	);
}

/** Acknowledges the exact initiating draft against the state already checked under the lock. */
export function flushSubmittedDraft(
	context: TrainingStateContext,
	latest: PersistedAppState,
	captured: PersistedAppState,
	model: ModelRecord
): { ok: true; state: PersistedAppState } | PersistenceFailure {
	const stored = latest.models.find(
		(record) => record.num === model.num && record.createdAt === model.createdAt
	);
	if (
		!stored ||
		stored.status !== 'draft' ||
		latest.trainingDomainGeneration !== captured.trainingDomainGeneration ||
		latest.dataset?.id !== captured.dataset?.id ||
		latest.target !== captured.target
	) {
		return { ok: false, reason: 'conflict' };
	}
	if (!sameDraft(stored, model)) {
		const base = acknowledgedState?.models.find(
			(record) => record.num === model.num && record.createdAt === model.createdAt
		);
		if (
			!base ||
			acknowledgedState?.trainingDomainGeneration !== latest.trainingDomainGeneration ||
			!sameDraft(base, stored)
		) {
			return { ok: false, reason: 'conflict' };
		}
	}
	const patched = mergeTrainingLogEdit(
		latest,
		mergeOrdinaryModel(stored, stored, model, true, !protectedPersistence)
	);
	const state = {
		...latest,
		models: latest.models.map((record) => (record === stored ? patched : record))
	};
	const ack = writeAcknowledgedSnapshot(context.storage, state);
	if (!ack.ok) return ack;
	acknowledgedState = state;
	return { ok: true, state };
}

function mergeOrdinaryModel(
	stored: ModelRecord,
	base: ModelRecord,
	captured: ModelRecord,
	sameGeneration: boolean,
	includeTrainingLog = false
): ModelRecord {
	const ui = { ...stored.ui };
	for (const key of new Set([...Object.keys(base.ui), ...Object.keys(captured.ui)])) {
		if (key === 'trainingLogOpen' && !includeTrainingLog) continue;
		if (base.ui[key] === captured.ui[key]) continue;
		if (Object.hasOwn(captured.ui, key)) ui[key] = captured.ui[key];
		else delete ui[key];
	}
	const result: ModelRecord = { ...stored, ui };
	if (!sameGeneration) return result;
	if (
		stored.status === 'training' &&
		captured.status === 'training' &&
		captured.resultRevision === stored.resultRevision &&
		captured.progress !== base.progress
	) {
		return { ...result, progress: captured.progress };
	}
	if (stored.status !== 'draft' || captured.status !== 'draft') return result;
	for (const field of draftFields) {
		if (captured[field] !== base[field]) Object.assign(result, { [field]: captured[field] });
	}
	if (captured.completedSteps !== base.completedSteps) {
		result.completedSteps = [
			...draftSteps(captured),
			...stored.completedSteps.filter(
				(section) => section === 'training' || section === 'results'
			)
		];
	}
	return result;
}

function mergeOrdinaryState(
	latest: PersistedAppState,
	base: PersistedAppState,
	captured: PersistedAppState
): PersistedAppState {
	const sameContext =
		latest.dataset?.id === captured.dataset?.id && latest.target === captured.target;
	return {
		...latest,
		updatedAt: Date.now(),
		onboarding: captured.onboarding,
		resumePath: captured.resumePath,
		results: captured.results,
		data: sameContext ? captured.data : latest.data,
		models: sameContext
			? latest.models.map((stored) => {
					const local = captured.models.find(
						(record) =>
							record.num === stored.num && record.createdAt === stored.createdAt
					);
					const before = base.models.find(
						(record) =>
							record.num === stored.num && record.createdAt === stored.createdAt
					);
					return local && before
						? mergeOrdinaryModel(
								stored,
								before,
								local,
								latest.trainingDomainGeneration ===
									captured.trainingDomainGeneration &&
									latest.trainingDomainGeneration ===
										base.trainingDomainGeneration
							)
						: stored;
				})
			: latest.models
	};
}

function keepLocalOrdinaryChanges(
	candidate: PersistedAppState,
	previous: PersistedAppState,
	keepDraftEdits: boolean
): PersistedAppState {
	const local = $appState.get();
	if (
		!protectedPersistence ||
		local.trainingDomainGeneration !== previous.trainingDomainGeneration
	)
		return candidate;
	const base = ordinaryBase ?? acknowledgedState ?? previous;
	const sameDomain =
		candidate.dataset?.id === local.dataset?.id &&
		candidate.target === local.target &&
		previous.dataset?.id === local.dataset?.id &&
		previous.target === local.target;
	const models = sameDomain
		? candidate.models.map((updated) => {
				const sameModel = (model: ModelRecord) =>
					model.num === updated.num && model.createdAt === updated.createdAt;
				const old = previous.models.find(sameModel);
				const before = base.models.find(sameModel);
				const edited = local.models.find(sameModel);
				if (!old || !before || !edited) return updated;
				// The first publication can include debounced edits to an unchanged draft.
				const draftUnchanged =
					keepDraftEdits &&
					before.status === 'draft' &&
					old.status === 'draft' &&
					updated.status === 'draft' &&
					sameDraft(old, updated) &&
					sameDraft(old, before);
				return mergeOrdinaryModel(updated, before, edited, draftUnchanged);
			})
		: candidate.models;
	const data =
		sameDomain && JSON.stringify(candidate.data) === JSON.stringify(previous.data)
			? local.data
			: candidate.data;
	return {
		...candidate,
		onboarding: local.onboarding,
		resumePath: local.resumePath,
		results: local.results,
		models,
		data
	};
}

function writeOrdinaryGuarded(
	storage: StorageAdapter,
	write: (context: TrainingStateContext, snapshot: GuardedSnapshot) => PersistenceAck
): void {
	void withTrainingStateLock(
		async (context): Promise<PersistenceAck> => {
			const snapshot = await readGuardedTrainingSnapshot(context);
			if (!snapshot.ok) return snapshot;
			if (snapshot.replayed) return { ok: true, generation: snapshot.generation };
			return write(context, snapshot);
		},
		{ ...protectedPersistence, storage }
	).then(noteOrdinaryFailure);
}

/** The candidate generated from the latest authoritative state under its lock. */
export interface ProtectedTrainingChange {
	pending: PendingTrainingDomain;
	mutation: TrainingDomainMutation;
}

/** Prepares, commits and publishes a single protected update while holding the state lock. */
export function commitProtectedTrainingChange(
	prepare: (
		current: GuardedSnapshot,
		context: TrainingStateContext
	) =>
		| ProtectedTrainingChange
		| PersistenceFailure
		| null
		| Promise<ProtectedTrainingChange | PersistenceFailure | null>,
	options: TrainingPersistenceOptions & {
		onCommitted?: (checkpoint: TrainingDomainCheckpoint) => void;
	} = {}
): Promise<PersistenceAck> {
	return withTrainingStateLock(async (context): Promise<PersistenceAck> => {
		const current = await readGuardedTrainingSnapshot(context);
		if (!current.ok) return current;
		const change = await prepare(current, context);
		if (change === null) return { ok: true, generation: current.generation };
		if ('ok' in change) return change;
		const committed = await commitTrainingCheckpoint(
			context.db,
			current.generation,
			change.pending,
			change.mutation
		);
		if (!committed.ok) return committed;
		options.onCommitted?.(committed.checkpoint);
		const published = await publishPending(context, committed.checkpoint, current.state, true);
		return published.ok ? { ok: true, generation: committed.checkpoint.generation } : published;
	}, options);
}

/** Retries publication of an existing checkpoint without repeating its resource mutation. */
export function retryTrainingPublication(
	options?: TrainingPersistenceOptions
): Promise<PersistenceAck> {
	return withTrainingStateLock(async (context): Promise<PersistenceAck> => {
		const snapshot = await readGuardedTrainingSnapshot(context);
		if (!snapshot.ok) return snapshot;
		if (!snapshot.state && snapshot.generation > 0) return { ok: false, reason: 'conflict' };
		return { ok: true, generation: snapshot.generation };
	}, options);
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
	/** Enables guarded browser writers and supplies optional lock/storage seams. */
	trainingPersistence?: TrainingPersistenceOptions;
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
	if (!protectedPersistence) {
		noteOrdinaryFailure(safeSetItem(storage, STATE_STORAGE_KEY, serialiseAppState(state)));
		return;
	}
	const base = ordinaryBase ?? state;
	ordinaryBase = undefined;
	writeOrdinaryGuarded(storage, (context, snapshot) => {
		if (!snapshot.state && snapshot.generation !== 0) return { ok: false, reason: 'conflict' };
		const stateToWrite = mergeTrainingLogEdits(
			mergeOrdinaryState(snapshot.state ?? INITIAL_APP_STATE, base, state)
		);
		const ack = writeAcknowledgedSnapshot(context.storage, stateToWrite);
		if (ack.ok) acknowledgedState = stateToWrite;
		return ack;
	});
}

/**
 * Writes current scroll state synchronously to storage.
 */
function writeScrollStateNow(storage: StorageAdapter, scroll: PersistedScroll): void {
	if (pendingScrollTimer !== undefined) {
		clearTimeout(pendingScrollTimer);
		pendingScrollTimer = undefined;
	}
	if (!protectedPersistence) {
		noteOrdinaryFailure(safeSetItem(storage, SCROLL_STORAGE_KEY, JSON.stringify(scroll)));
		return;
	}
	writeOrdinaryGuarded(storage, (context, snapshot) => {
		const ack = safeSetItem(context.storage, SCROLL_STORAGE_KEY, JSON.stringify(scroll));
		return ack.ok ? { ok: true, generation: snapshot.generation } : ack;
	});
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
	writeAppStateNow(s, $appState.get());
	writeScrollStateNow(s, $scrollState.get());
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
		activeStorage = storage;
	}

	const debounceScrollMs = options.debounceScrollMs ?? 150;
	const debounceFieldMs = options.debounceFieldMs ?? 300;
	const throttleProgressMs = options.throttleProgressMs ?? 1000;
	protectedPersistence = options.trainingPersistence;

	previousAppState = $appState.get();

	unbindAppState = $appState.subscribe((nextState) => {
		if (publishingSnapshot) {
			previousAppState = nextState;
			return;
		}
		if (protectedPersistence && previousAppState === nextState) return;
		if (protectedPersistence && previousAppState) {
			recordTrainingLogEdits(previousAppState, nextState);
		}
		ordinaryBase ??= previousAppState;
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
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				flushNow();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', flushNow);
		unbindLifecycle = () => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', flushNow);
		};
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
	unbindLifecycle?.();
	unbindLifecycle = undefined;
	ordinaryBase = undefined;
	trainingLogEdits.clear();
	protectedPersistence = undefined;
}
