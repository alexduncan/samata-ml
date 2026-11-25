import { atom } from 'nanostores';
import { sameTrainingRun } from '../features/models/training/result-validation';
import { getTrainingService } from '../features/models/training/training-service';
import type { TrainingCommandResult } from '../features/models/training/training-service';
import { $appState, setResumePath } from '../stores/app.store';
import { currentResultIdentity } from '../stores/model-results.store';
import { flushNow } from '../stores/persister';
import type { TrainingRunIdentity } from '../types/model-result';
import type {
	HistoryEntryState,
	ParsedRoute,
	ProvisionalEntry,
	ReservedPath
} from '../types/routes';
import { provisionalModelIn } from '../types/state';
import type {
	PersistedAppState,
	ProvisionalModelContext,
	ProvisionalModelIdentity
} from '../types/state';
import { parseRoute } from './route-parser';

/**
 * Nanostore exposing the currently active parsed route.
 * Follows specification/app-state-and-navigation.md §5.1.
 */
export const $route = atom<ParsedRoute>(
	typeof window !== 'undefined' ? parseRoute(window.location.pathname) : { kind: 'root' }
);

let isSyncingFromHistory = false;
let routerInitialized = false;
let cleanupListeners: (() => void) | undefined;
let inAppHistoryCount = 0;
let pendingFocusRequest = false;
let activeEntry: HistoryEntryState | undefined;
const allocations = new Map<string, object>();
const provisionalLedger = new Map<string, ProvisionalEntry>();

function contextOf(state: PersistedAppState): ProvisionalModelContext | undefined {
	if (!state.dataset || !state.target) return;
	return {
		datasetId: state.dataset.id,
		target: state.target,
		comparisonContextEpoch: state.comparisonContextEpoch
	};
}

function sameContext(left: ProvisionalModelContext, right?: ProvisionalModelContext): boolean {
	return (
		left.datasetId === right?.datasetId &&
		left.target === right.target &&
		left.comparisonContextEpoch === right.comparisonContextEpoch
	);
}

/** Whether the captured entry is still in the same dataset, target and comparison epoch. */
export function isCurrentProvisionalContext(context: ProvisionalModelContext): boolean {
	return sameContext(context, contextOf($appState.get()));
}

function sameBinding(left: ProvisionalModelIdentity, right: ProvisionalModelIdentity): boolean {
	return (
		sameContext(left, right) &&
		left.modelNum === right.modelNum &&
		left.modelCreatedAt === right.modelCreatedAt
	);
}

function pointerBinding(state: PersistedAppState): ProvisionalModelIdentity | undefined {
	const context = contextOf(state);
	const model = provisionalModelIn(state.models, state.newModelNum);
	return context && model
		? { ...context, modelNum: model.num, modelCreatedAt: model.createdAt }
		: undefined;
}

/** Matches the entry to the current provisional draft or the same model's first saved run. */
export function provisionalRouteModel(identity: ProvisionalModelIdentity, state = $appState.get()) {
	if (!sameContext(identity, contextOf(state))) return;
	const model = state.models.find(
		(model) => model.num === identity.modelNum && model.createdAt === identity.modelCreatedAt
	);
	if (model?.status === 'trained') {
		if (
			model.provisionalCompletedRunId &&
			model.provisionalCompletedRunId === model.resultRevision
		)
			return model;
	} else if (model?.num === state.newModelNum && !model.provisionalCompletedRunId) {
		return model;
	}
}

/** Derives the expected saved identity for the run pinned to this exact route entry. */
export function provisionalResultIdentity(
	binding: ProvisionalModelIdentity
): TrainingRunIdentity | null {
	const model = provisionalRouteModel(binding);
	return model?.status === 'trained' ? currentResultIdentity(model.num) : null;
}

/** The workflow view beneath a reserved route, with the same provisional identity. */
export function getEffectiveWorkflowRoute(route: ParsedRoute): ParsedRoute {
	if (route.kind === 'workflow') return route;
	const parsed = parseRoute(
		(route.kind === 'reserved' ? route.underlayPath : undefined) ?? $appState.get().resumePath
	);
	if (
		parsed.kind === 'workflow' &&
		parsed.path === '/models/new' &&
		route.kind === 'reserved' &&
		route.provisional
	)
		return { ...parsed, provisional: route.provisional };
	return parsed;
}

/** Resolves the model number for a visible or covered workflow route. */
export function getEffectiveModelNum(route: ParsedRoute): number | undefined {
	const workflow = getEffectiveWorkflowRoute(route);
	if (workflow.kind !== 'workflow') return;
	if (workflow.path !== '/models/new') return workflow.modelNum;
	return workflow.provisional?.kind === 'bound'
		? workflow.provisional.identity.modelNum
		: undefined;
}

/** Identifies the history entry owning the visible workflow or reserved underlay. */
export function getWorkflowEntryId(): string | undefined {
	return $route.get().kind === 'reserved' ? activeEntry?.underlayEntryId : activeEntry?.entryId;
}

function newEntry(): HistoryEntryState {
	return { v: 1, entryId: Math.random().toString(36).slice(2) };
}

function validContext(value?: ProvisionalModelContext): value is ProvisionalModelContext {
	return (
		typeof value?.datasetId === 'string' &&
		Boolean(value.datasetId) &&
		typeof value.target === 'string' &&
		Boolean(value.target) &&
		Number.isSafeInteger(value.comparisonContextEpoch) &&
		value.comparisonContextEpoch >= 0
	);
}

function validBinding(value?: ProvisionalModelIdentity): value is ProvisionalModelIdentity {
	return (
		validContext(value) &&
		Number.isSafeInteger(value.modelNum) &&
		value.modelNum > 0 &&
		Number.isFinite(value.modelCreatedAt) &&
		value.modelCreatedAt >= 0
	);
}

function readEntry(): HistoryEntryState | undefined {
	const state = window.history.state as Partial<HistoryEntryState> | null;
	if (state?.v !== 1 || typeof state.entryId !== 'string' || !state.entryId) return;
	const entry: HistoryEntryState = { ...state, v: 1, entryId: state.entryId };
	const provisional = entry.provisional;
	if (provisional?.kind === 'pending' && validContext(provisional.context)) {
		if (
			!validBinding(provisional.candidate) ||
			!sameContext(provisional.context, provisional.candidate)
		)
			entry.provisional = { kind: 'pending', context: provisional.context };
	} else if (provisional?.kind !== 'bound' || !validBinding(provisional.identity)) {
		delete entry.provisional;
	}
	if (
		typeof entry.underlayPath !== 'string' ||
		parseRoute(entry.underlayPath).kind !== 'workflow'
	)
		delete entry.underlayPath;
	if (typeof entry.underlayEntryId !== 'string') delete entry.underlayEntryId;
	return entry;
}

function publishRoute(route: ParsedRoute, entry: HistoryEntryState): void {
	let resolved = route;
	const sourceId = route.kind === 'reserved' ? entry.underlayEntryId : entry.entryId;
	const provisional =
		entry.provisional?.kind === 'pending' && sourceId && allocations.has(sourceId)
			? { kind: 'loading' as const, context: entry.provisional.context }
			: entry.provisional;
	if (route.kind === 'workflow' && route.path === '/models/new' && provisional) {
		resolved = { ...route, provisional };
	} else if (route.kind === 'reserved') {
		resolved = { ...route, underlayPath: entry.underlayPath };
		if (entry.underlayPath === '/models/new' && provisional)
			resolved = { ...resolved, provisional };
	}
	activeEntry = entry;
	if (resolved.kind === 'workflow' && resolved.path !== $appState.get().resumePath)
		setResumePath(resolved.path);
	$route.set(resolved);
	updateTitle(resolved);
}

function prepareEntry(
	route: ParsedRoute,
	entry: HistoryEntryState,
	allowAllocation: boolean
): { route: ParsedRoute; start: boolean } {
	const state = $appState.get();
	const inferred = route.kind === 'root' || route.kind === 'unknown';
	if (inferred) route = parseRoute(state.resumePath);
	const reserved = route.kind === 'reserved';
	let work = reserved ? parseRoute(entry.underlayPath ?? state.resumePath) : route;
	if (work.kind !== 'workflow') return { route, start: false };
	const pointer = pointerBinding(state);
	const aliasesPointer = pointer && work.modelNum === pointer.modelNum;
	let start = false;
	if (aliasesPointer) {
		work = { kind: 'workflow', path: '/models/new', section: 3 };
		entry.provisional = { kind: 'bound', identity: pointer };
	} else if (work.path === '/models/new') {
		const sourceId = reserved ? entry.underlayEntryId : entry.entryId;
		const cached = sourceId ? provisionalLedger.get(sourceId) : undefined;
		const outgoing =
			sourceId && activeEntry?.underlayEntryId === sourceId && activeEntry?.provisional;
		const binding =
			cached?.kind === 'bound'
				? cached.identity
				: outgoing && outgoing.kind === 'bound'
					? outgoing.identity
					: undefined;
		if (
			entry.provisional?.kind === 'pending' &&
			binding &&
			sameContext(entry.provisional.context, binding) &&
			(!entry.provisional.candidate || sameBinding(entry.provisional.candidate, binding))
		) {
			entry.provisional = { kind: 'bound', identity: binding };
		} else if (
			entry.provisional?.kind === 'pending' &&
			cached?.kind === 'pending' &&
			sameContext(entry.provisional.context, cached.context)
		) {
			entry.provisional = cached;
		} else if (!entry.provisional) {
			if (inferred || reserved || !allowAllocation) {
				if (pointer) entry.provisional = { kind: 'bound', identity: pointer };
				else work = { kind: 'workflow', path: '/models', section: 3 };
			} else {
				const context = contextOf(state);
				if (context) {
					entry.provisional = { kind: 'pending', context, candidate: pointer };
					start = true;
				}
			}
		}
	} else {
		delete entry.provisional;
	}
	if (route.kind === 'reserved') {
		entry.underlayPath = work.path;
		return { route, start: false };
	}
	return { route: work, start };
}

async function allocateProvisional(
	entry: HistoryEntryState,
	pending: Extract<ProvisionalEntry, { kind: 'pending' }>,
	allowAllocation: boolean
): Promise<void> {
	const sourceId = entry.entryId;
	if (!sameContext(pending.context, contextOf($appState.get())) || allocations.has(sourceId))
		return;
	const operation = {};
	allocations.set(sourceId, operation);
	publishRoute(parseRoute(window.location.pathname), entry);
	let candidate = pending.candidate;
	let acknowledged: ProvisionalModelIdentity | undefined;
	try {
		const service = getTrainingService();
		const recovered = allowAllocation || (await service.retry()).ok;
		if (recovered) {
			const result = await service.openNewModel(pending.context, allowAllocation, candidate);
			if (result.ok) acknowledged = result.value;
			else candidate = result.candidate ?? candidate;
		}
	} finally {
		if (allocations.get(sourceId) === operation) {
			allocations.delete(sourceId);
			const state = $appState.get();
			const binding =
				acknowledged && provisionalRouteModel(acknowledged, state)
					? acknowledged
					: undefined;
			const resolved: ProvisionalEntry = binding
				? { kind: 'bound', identity: binding }
				: { ...pending, candidate };
			provisionalLedger.set(sourceId, resolved);
			const current = readEntry();
			if (
				current &&
				(current.entryId === sourceId || current.underlayEntryId === sourceId) &&
				current.provisional?.kind === 'pending' &&
				sameContext(current.provisional.context, pending.context)
			) {
				current.provisional = resolved;
				window.history.replaceState(current, '');
				publishRoute(parseRoute(window.location.pathname), current);
			}
		}
	}
}

/** Retries an existing publication or adopts the original provisional pointer, without allocating. */
export function retryProvisionalRoute(): void {
	const entry = readEntry();
	const route = $route.get();
	if (
		route.kind !== 'workflow' ||
		route.path !== '/models/new' ||
		entry?.provisional?.kind !== 'pending'
	)
		return;
	void allocateProvisional(entry, entry.provisional, false);
}

/** Acknowledges the pinned run and replaces the currently visible provisional entry with results. */
export async function promoteProvisionalResult(
	identity: TrainingRunIdentity,
	retry = false
): Promise<TrainingCommandResult | { ok: false; code: 'conflict'; missingSavedResult: true }> {
	const source = activeEntry;
	const matches = () => {
		const route = $route.get();
		const binding =
			route.kind === 'workflow' &&
			route.path === '/models/new' &&
			route.provisional?.kind === 'bound'
				? route.provisional.identity
				: undefined;
		const expected = binding && provisionalResultIdentity(binding);
		return (
			source?.entryId === activeEntry?.entryId &&
			expected &&
			sameTrainingRun(identity, expected)
		);
	};
	if (!matches()) return { ok: false, code: 'conflict' };
	const service = getTrainingService();
	if (retry) {
		const recovered = await service.retry(identity);
		if (!recovered.ok) return recovered;
	}
	const loaded = await service.loadCompletedResult(identity.modelNum, identity);
	if (!matches()) return { ok: false, code: 'conflict' };
	if (!loaded || !sameTrainingRun(identity, loaded))
		return { ok: false, code: 'conflict', missingSavedResult: true };
	const result = await service.viewResults(identity);
	if (result.ok && matches()) navigate(`/models/${identity.modelNum}`, { replace: true });
	return result;
}

/**
 * Returns true once after a user-initiated workflow navigation, so the shell can move focus (§5.6).
 */
export function takeFocusRequest(): boolean {
	const requested = pendingFocusRequest;
	pendingFocusRequest = false;
	return requested;
}

/**
 * Maps a parsed route to its canonical document title: `samatā.ml | {Page}`
 */
export function getDocumentTitle(route: ParsedRoute): string {
	const BASE_TITLE = 'samatā.ml';
	switch (route.kind) {
		case 'root':
			return BASE_TITLE;
		case 'workflow':
			switch (route.path) {
				case '/data':
					return `${BASE_TITLE} | Load Data`;
				case '/target':
					return `${BASE_TITLE} | Set Target`;
				case '/models':
					return `${BASE_TITLE} | Train Models`;
				case '/results':
					return `${BASE_TITLE} | Compare Results`;
				case '/models/new': {
					const num = getEffectiveModelNum(route);
					return num === undefined
						? `${BASE_TITLE} | Train New Model`
						: `${BASE_TITLE} | Model ${num}`;
				}
				default:
					if (route.modelNum !== undefined) {
						return `${BASE_TITLE} | Model ${route.modelNum}`;
					}
					return `${BASE_TITLE} | Train Models`;
			}
		case 'reserved':
			switch (route.path) {
				case '/about':
					return `${BASE_TITLE} | About`;
				case '/privacy':
					return `${BASE_TITLE} | Privacy`;
				case '/help':
					return `${BASE_TITLE} | Help`;
				case '/help/configure-model':
					return `${BASE_TITLE} | What do these settings mean?`;
				case '/help/training-setup':
					return `${BASE_TITLE} | Training Setup`;
			}
		case 'unknown':
			return BASE_TITLE;
	}
}

/**
 * Updates document.title to match the current route.
 */
function updateTitle(route: ParsedRoute): void {
	if (typeof document !== 'undefined') {
		document.title = getDocumentTitle(route);
	}
}

/**
 * Navigates to a workflow or application route.
 *
 * @param path - The target pathname.
 * @param options - Navigation options (e.g. `{ replace: true }`).
 */
export function navigate(path: string, options?: { replace?: boolean }): void {
	internalNavigate(path, options, true);
}

function internalNavigate(
	path: string,
	options?: { replace?: boolean },
	requestFocus: boolean = true,
	requestedBinding?: ProvisionalModelIdentity
): void {
	if (typeof window === 'undefined') {
		const parsed = parseRoute(path);
		if (requestFocus && parsed.kind === 'workflow') {
			pendingFocusRequest = true;
		}
		$route.set(parsed);
		return;
	}

	// Normalise away trailing slash for comparison
	const normalisedTarget = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
	const currentPath =
		window.location.pathname.length > 1 && window.location.pathname.endsWith('/')
			? window.location.pathname.slice(0, -1)
			: window.location.pathname;

	// No-op if already on the target path (prevents duplicate history entries per §5.2)
	if (normalisedTarget === currentPath && !options?.replace) {
		return;
	}

	const requested = parseRoute(normalisedTarget);
	if (requested.kind === 'reserved') {
		openReserved(requested.path);
		return;
	}
	const entry = newEntry();
	if (requested.kind === 'workflow' && requested.path === '/models/new' && requestedBinding)
		entry.provisional = { kind: 'bound', identity: requestedBinding };
	const { route, start } = prepareEntry(requested, entry, true);
	const pathToWrite = route.kind === 'workflow' ? route.path : normalisedTarget;
	if (route.kind === 'workflow' && route.path !== $appState.get().resumePath)
		setResumePath(route.path);
	flushNow();
	if (options?.replace || requested.kind === 'root' || requested.kind === 'unknown') {
		window.history.replaceState(entry, '', pathToWrite);
	} else {
		window.history.pushState(entry, '', pathToWrite);
		inAppHistoryCount++;
	}
	pendingFocusRequest = requestFocus && route.kind === 'workflow';
	if (start && entry.provisional?.kind === 'pending')
		void allocateProvisional(entry, entry.provisional, true);
	else publishRoute(route, entry);
}

/**
 * Opens a reserved modal route (/about, /privacy, /help).
 *
 * @param path - The reserved route path.
 */
export function openReserved(path: ReservedPath): void {
	if (typeof window === 'undefined') {
		const currentRoute = $route.get();
		const underlayPath =
			(currentRoute.kind === 'workflow'
				? currentRoute.path
				: currentRoute.kind === 'reserved'
					? currentRoute.underlayPath
					: $appState.get().resumePath) ?? '/data';
		$route.set({ kind: 'reserved', path, underlayPath });
		return;
	}

	if (window.location.pathname === path) return;
	const currentRoute = $route.get();
	const prior = readEntry();
	const workflow = getEffectiveWorkflowRoute(currentRoute);
	const reserved = currentRoute.kind === 'reserved';
	const entry = reserved && prior ? prior : newEntry();
	if (!reserved && prior) {
		entry.underlayEntryId = prior.entryId;
		entry.provisional = prior.provisional;
	}
	if (workflow.kind === 'workflow') entry.underlayPath = workflow.path;
	const { route } = prepareEntry({ kind: 'reserved', path }, entry, false);
	flushNow();
	pendingFocusRequest = false;
	if (reserved) window.history.replaceState(entry, '', path);
	else {
		window.history.pushState(entry, '', path);
		inAppHistoryCount++;
	}
	publishRoute(route, entry);
}

/**
 * Closes an active reserved route modal.
 */
export function closeReserved(): void {
	if (typeof window === 'undefined') {
		return;
	}

	const current = $route.get();
	if (current.kind !== 'reserved') {
		return;
	}

	// If opened in this document, use history.back()
	if (inAppHistoryCount > 0) {
		inAppHistoryCount--;
		window.history.back();
	} else {
		const prior = readEntry();
		const entry = newEntry();
		if (prior?.underlayEntryId) entry.entryId = prior.underlayEntryId;
		entry.provisional = prior?.provisional;
		const { route } = prepareEntry(getEffectiveWorkflowRoute(current), entry, false);
		if (route.kind !== 'workflow') return;
		pendingFocusRequest = false;
		flushNow();
		window.history.replaceState(entry, '', route.path);
		publishRoute(route, entry);
	}
}

/**
 * Intercepts primary same-origin <a> clicks.
 */
function handleClick(event: MouseEvent): void {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	) {
		return;
	}

	const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
	let anchor: HTMLAnchorElement | null = null;
	for (const node of path) {
		if (node instanceof HTMLAnchorElement) {
			anchor = node;
			break;
		}
	}
	if (!anchor && event.target instanceof Element) {
		anchor = event.target.closest('a');
	}
	if (!anchor) return;

	// Ignore links with target or download
	if (anchor.hasAttribute('download')) return;
	const anchorTarget = anchor.getAttribute('target');
	if (anchorTarget && anchorTarget !== '_self') return;

	// Ignore external origins
	if (anchor.origin !== window.location.origin) return;

	const href = anchor.getAttribute('href');
	if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

	event.preventDefault();
	const parsed = parseRoute(anchor.pathname);
	if (parsed.kind === 'reserved') {
		openReserved(parsed.path);
	} else {
		const num = anchor.dataset.provisionalNum;
		const createdAt = anchor.dataset.provisionalCreatedAt;
		const context = contextOf($appState.get());
		if (parsed.kind === 'workflow' && parsed.path === '/models/new' && num && createdAt) {
			const binding = context && {
				...context,
				modelNum: Number(num),
				modelCreatedAt: Number(createdAt)
			};
			if (validBinding(binding)) internalNavigate(parsed.path, undefined, true, binding);
			else navigate('/models');
		} else navigate(anchor.pathname);
	}
}

/**
 * Handles browser history popstate events.
 */
function handlePopState(): void {
	if (typeof window === 'undefined') return;

	isSyncingFromHistory = true;
	try {
		const entry = readEntry() ?? newEntry();
		const { route } = prepareEntry(parseRoute(window.location.pathname), entry, false);
		pendingFocusRequest = route.kind === 'workflow' && $route.get().kind === 'workflow';
		if (route.kind === 'workflow' || route.kind === 'reserved') {
			flushNow();
			window.history.replaceState(
				entry,
				'',
				route.path === window.location.pathname ? undefined : route.path
			);
		}
		publishRoute(route, entry);
	} finally {
		isSyncingFromHistory = false;
	}
}

/**
 * Returns whether the router is currently syncing route state from browser history.
 */
export function getIsSyncingFromHistory(): boolean {
	return isSyncingFromHistory;
}

/**
 * Initialises client-side router event listeners and resolves the initial URL.
 */
export function initRouter(): () => void {
	if (routerInitialized) {
		return cleanupListeners ?? (() => {});
	}

	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return () => {};
	}

	routerInitialized = true;

	// Set manual scroll restoration per §5.1
	if ('scrollRestoration' in window.history) {
		window.history.scrollRestoration = 'manual';
	}

	window.addEventListener('popstate', handlePopState);
	document.addEventListener('click', handleClick);

	const stopWatchingContext = $appState.listen((next, previous) => {
		const changed =
			next.dataset?.id !== previous?.dataset?.id ||
			next.target !== previous?.target ||
			next.comparisonContextEpoch !== previous?.comparisonContextEpoch;
		if (changed) {
			allocations.clear();
			provisionalLedger.clear();
		}
	});

	cleanupListeners = () => {
		window.removeEventListener('popstate', handlePopState);
		document.removeEventListener('click', handleClick);
		stopWatchingContext();
		allocations.clear();
		provisionalLedger.clear();
		activeEntry = undefined;
		routerInitialized = false;
		cleanupListeners = undefined;
	};

	const requested = parseRoute(window.location.pathname);
	const prior = readEntry();
	const entry = prior ?? newEntry();
	const { route, start } = prepareEntry(requested, entry, !prior);
	pendingFocusRequest = false;
	if (route.kind === 'workflow' || route.kind === 'reserved') {
		flushNow();
		window.history.replaceState(
			entry,
			'',
			route.path === window.location.pathname ? undefined : route.path
		);
	}
	if (start && entry.provisional?.kind === 'pending')
		void allocateProvisional(entry, entry.provisional, true);
	else publishRoute(route, entry);

	return cleanupListeners;
}

/**
 * Stops router listeners for test cleanup.
 */
export function stopRouter(): void {
	if (cleanupListeners) {
		cleanupListeners();
	}
	inAppHistoryCount = 0;
	routerInitialized = false;
	pendingFocusRequest = false;
}
