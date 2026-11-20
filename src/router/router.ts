import { atom } from 'nanostores';
import { $appState, setResumePath } from '../stores/app.store';
import { flushNow } from '../stores/persister';
import type { HistoryEntryState, ParsedRoute, ReservedPath, WorkflowPath } from '../types/routes';
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

/**
 * Returns true once after a user-initiated workflow navigation, so the shell can move focus (§5.6).
 */
export function takeFocusRequest(): boolean {
	const requested = pendingFocusRequest;
	pendingFocusRequest = false;
	return requested;
}

/**
 * Maps a parsed route to its canonical document title: samatā.ml | {Page}
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
 * @param options - Navigation options (e.g. { replace: true }).
 */
export function navigate(path: string, options?: { replace?: boolean }): void {
	internalNavigate(path, options, true);
}

function internalNavigate(
	path: string,
	options?: { replace?: boolean },
	requestFocus: boolean = true
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

	let targetPath = normalisedTarget;
	let parsed = parseRoute(targetPath);

	// Root path resolves to persisted resumePath with replaceState
	if (parsed.kind === 'root') {
		const resume = $appState.get().resumePath || '/data';
		targetPath = resume;
		parsed = parseRoute(resume);
		options = { ...options, replace: true };
	} else if (parsed.kind === 'unknown') {
		// Unknown paths redirect to resumePath with replaceState
		const resume = $appState.get().resumePath || '/data';
		targetPath = resume;
		parsed = parseRoute(resume);
		options = { ...options, replace: true };
	}

	// Update resumePath in app state for workflow routes
	if (parsed.kind === 'workflow') {
		setResumePath(parsed.path);
	}

	const historyState: HistoryEntryState = {
		v: 1,
		entryId: Math.random().toString(36).slice(2)
	};

	flushNow();

	if (options?.replace) {
		window.history.replaceState(historyState, '', targetPath);
	} else {
		window.history.pushState(historyState, '', targetPath);
		inAppHistoryCount++;
	}

	if (requestFocus && parsed.kind === 'workflow') {
		pendingFocusRequest = true;
	} else if (!requestFocus) {
		pendingFocusRequest = false;
	}

	$route.set(parsed);
	updateTitle(parsed);
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

	const currentRoute = $route.get();
	const currentPath = window.location.pathname;

	// Duplicate reserved route is a no-op
	if (currentPath === path) {
		return;
	}

	if (currentRoute.kind === 'reserved') {
		// Reserved -> reserved replaces state to never stack modal entries (§5.2)
		const existingUnderlay =
			(window.history.state as HistoryEntryState)?.underlayPath ??
			currentRoute.underlayPath ??
			$appState.get().resumePath ??
			'/data';
		const historyState: HistoryEntryState = {
			v: 1,
			entryId: Math.random().toString(36).slice(2),
			underlayPath: existingUnderlay
		};
		flushNow();
		window.history.replaceState(historyState, '', path);
		const parsed: ParsedRoute = { kind: 'reserved', path, underlayPath: existingUnderlay };
		$route.set(parsed);
		updateTitle(parsed);
	} else {
		// Workflow -> reserved pushes new entry carrying underlayPath
		const underlayPath =
			(currentRoute.kind === 'workflow' ? currentRoute.path : $appState.get().resumePath) ??
			'/data';
		const historyState: HistoryEntryState = {
			v: 1,
			entryId: Math.random().toString(36).slice(2),
			underlayPath
		};
		flushNow();
		window.history.pushState(historyState, '', path);
		inAppHistoryCount++;
		const parsed: ParsedRoute = { kind: 'reserved', path, underlayPath };
		$route.set(parsed);
		updateTitle(parsed);
	}
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
		// If loaded directly from URL, replaceState to underlayPath without requesting focus
		const underlay =
			(window.history.state as HistoryEntryState)?.underlayPath ??
			current.underlayPath ??
			$appState.get().resumePath ??
			'/data';
		internalNavigate(underlay, { replace: true }, false);
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
		navigate(anchor.pathname);
	}
}

/**
 * Handles browser history popstate events.
 */
function handlePopState(): void {
	if (typeof window === 'undefined') return;

	isSyncingFromHistory = true;
	try {
		const rawPath = window.location.pathname;
		const parsed = parseRoute(rawPath);
		const previousRoute = $route.get();

		if (parsed.kind === 'root' || parsed.kind === 'unknown') {
			const resume = $appState.get().resumePath || '/data';
			const historyState: HistoryEntryState = {
				v: 1,
				entryId: Math.random().toString(36).slice(2)
			};
			flushNow();
			window.history.replaceState(historyState, '', resume);
			const resolved = parseRoute(resume);
			if (resolved.kind === 'workflow' && previousRoute.kind === 'workflow') {
				pendingFocusRequest = true;
			} else {
				pendingFocusRequest = false;
			}
			$route.set(resolved);
			if (resolved.kind === 'workflow') {
				setResumePath(resolved.path);
			}
			updateTitle(resolved);
		} else if (parsed.kind === 'workflow') {
			if (previousRoute.kind === 'workflow') {
				pendingFocusRequest = true;
			} else {
				pendingFocusRequest = false;
			}
			$route.set(parsed);
			setResumePath(parsed.path);
			updateTitle(parsed);
		} else if (parsed.kind === 'reserved') {
			pendingFocusRequest = false;
			const resume = ($appState.get().resumePath || '/data') as WorkflowPath;
			const underlayPath = ((window.history.state as HistoryEntryState)?.underlayPath ??
				resume) as WorkflowPath;
			const resolved: ParsedRoute = { ...parsed, underlayPath };
			$route.set(resolved);
			updateTitle(resolved);
		}
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

	cleanupListeners = () => {
		window.removeEventListener('popstate', handlePopState);
		document.removeEventListener('click', handleClick);
		routerInitialized = false;
		cleanupListeners = undefined;
	};

	// Resolve initial route
	const rawPath = window.location.pathname;
	const parsed = parseRoute(rawPath);

	pendingFocusRequest = false;

	if (parsed.kind === 'root') {
		const resume = $appState.get().resumePath || '/data';
		flushNow();
		window.history.replaceState(
			{ v: 1, entryId: Math.random().toString(36).slice(2) },
			'',
			resume
		);
		const resolved = parseRoute(resume);
		$route.set(resolved);
		updateTitle(resolved);
	} else if (parsed.kind === 'unknown') {
		const resume = $appState.get().resumePath || '/data';
		flushNow();
		window.history.replaceState(
			{ v: 1, entryId: Math.random().toString(36).slice(2) },
			'',
			resume
		);
		const resolved = parseRoute(resume);
		$route.set(resolved);
		updateTitle(resolved);
	} else if (parsed.kind === 'reserved') {
		const resume = ($appState.get().resumePath || '/data') as WorkflowPath;
		const stateObj: HistoryEntryState = {
			v: 1,
			entryId: Math.random().toString(36).slice(2),
			underlayPath: resume
		};
		flushNow();
		window.history.replaceState(stateObj, '', parsed.path);
		const resolved: ParsedRoute = { ...parsed, underlayPath: resume };
		$route.set(resolved);
		updateTitle(resolved);
	} else {
		// Workflow route
		setResumePath(parsed.path);
		$route.set(parsed);
		updateTitle(parsed);
	}

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
