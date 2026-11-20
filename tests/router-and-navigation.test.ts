import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { RESERVED_CONTENT } from '../src/router/reserved-content';
import { parseRoute } from '../src/router/route-parser';
import {
	$route,
	navigate,
	openReserved,
	closeReserved,
	initRouter,
	stopRouter,
	getDocumentTitle,
	takeFocusRequest
} from '../src/router/router';
import {
	getScrollKeyForRoute,
	recordCurrentScroll,
	restoreScroll,
	initScrollRestorer,
	stopScrollRestorer,
	getActiveKey,
	getSavingEnabled
} from '../src/router/scroll-restorer';
import {
	$appState,
	setResumePath,
	loadDatasetSucceeded,
	setTarget,
	createModel,
	chooseModel,
	setHyperparameters
} from '../src/stores/app.store';
import { $scrollState, clearScroll } from '../src/stores/scroll.store';
import { initPersister, stopPersister, MemoryStorage, flushNow } from '../src/stores/persister';
import {
	INITIAL_APP_STATE,
	STATE_STORAGE_KEY,
	type DatasetSummary,
	type ScrollSnapshot
} from '../src/types/state';

const sampleDataset: DatasetSummary = {
	id: 'dataset-123',
	name: 'Iris Flower Dataset',
	source: 'sample',
	rowCount: 150,
	columns: [
		{ name: 'sepal_length', type: 'numeric', missingCount: 0 },
		{ name: 'sepal_width', type: 'numeric', missingCount: 0 },
		{ name: 'petal_length', type: 'numeric', missingCount: 0 },
		{ name: 'petal_width', type: 'numeric', missingCount: 0 },
		{ name: 'species', type: 'categorical', missingCount: 0 }
	]
};

describe('Router & Navigation (NAV-AC-1, NAV-AC-2, NAV-AC-4)', () => {
	beforeEach(() => {
		stopRouter();
		stopScrollRestorer();
		stopPersister();
		$appState.set({ ...INITIAL_APP_STATE });
		clearScroll();
		window.history.replaceState(null, '', '/data');
	});

	afterEach(() => {
		stopRouter();
		stopScrollRestorer();
		stopPersister();
	});

	describe('NAV-AC-1: URL route parsing', () => {
		it('parses root paths correctly', () => {
			expect(parseRoute('/')).toEqual({ kind: 'root' });
			expect(parseRoute('')).toEqual({ kind: 'root' });
		});

		it('parses all canonical workflow paths', () => {
			expect(parseRoute('/data')).toEqual({ kind: 'workflow', path: '/data', section: 1 });
			expect(parseRoute('/target')).toEqual({
				kind: 'workflow',
				path: '/target',
				section: 2
			});
			expect(parseRoute('/models')).toEqual({
				kind: 'workflow',
				path: '/models',
				section: 3
			});
			expect(parseRoute('/results')).toEqual({
				kind: 'workflow',
				path: '/results',
				section: 4
			});
		});

		it('parses valid model numbers as workflow routes', () => {
			expect(parseRoute('/models/1')).toEqual({
				kind: 'workflow',
				path: '/models/1',
				section: 3,
				modelNum: 1
			});
			expect(parseRoute('/models/42')).toEqual({
				kind: 'workflow',
				path: '/models/42',
				section: 3,
				modelNum: 42
			});
		});

		it('classifies invalid model numbers as unknown paths', () => {
			expect(parseRoute('/models/0')).toEqual({ kind: 'unknown', path: '/models/0' });
			expect(parseRoute('/models/-1')).toEqual({ kind: 'unknown', path: '/models/-1' });
			expect(parseRoute('/models/abc')).toEqual({ kind: 'unknown', path: '/models/abc' });
			expect(parseRoute('/models/1.5')).toEqual({ kind: 'unknown', path: '/models/1.5' });
			expect(parseRoute('/models/01')).toEqual({ kind: 'unknown', path: '/models/01' });
		});

		it('WML-P1-ROUTE-1: parses reserved paths correctly', () => {
			expect(parseRoute('/about')).toEqual({ kind: 'reserved', path: '/about' });
			expect(parseRoute('/privacy')).toEqual({ kind: 'reserved', path: '/privacy' });
			expect(parseRoute('/help')).toEqual({ kind: 'reserved', path: '/help' });
			expect(parseRoute('/help/configure-model')).toEqual({
				kind: 'reserved',
				path: '/help/configure-model'
			});
			expect(RESERVED_CONTENT['/help/configure-model']).toBe('configure-model');
		});

		it('WML-P2-ROUTE-1: reserves the training setup page and leaves other Help topics unknown', () => {
			for (const path of ['/help/training-setup', '/help/training-setup/']) {
				expect(parseRoute(path)).toEqual({
					kind: 'reserved',
					path: '/help/training-setup'
				});
			}
			expect(parseRoute('/help/other-topic').kind).toBe('unknown');
			expect(RESERVED_CONTENT['/help/training-setup']).toBe('training-setup');
		});

		it('normalises trailing slashes without breaking', () => {
			expect(parseRoute('/data/')).toEqual({ kind: 'workflow', path: '/data', section: 1 });
			expect(parseRoute('/target/')).toEqual({
				kind: 'workflow',
				path: '/target',
				section: 2
			});
			expect(parseRoute('/models/5/')).toEqual({
				kind: 'workflow',
				path: '/models/5',
				section: 3,
				modelNum: 5
			});
			expect(parseRoute('/about/')).toEqual({ kind: 'reserved', path: '/about' });
		});

		it('classifies arbitrary non-route paths as unknown', () => {
			expect(parseRoute('/unknown-path')).toEqual({ kind: 'unknown', path: '/unknown-path' });
			expect(parseRoute('/foo/bar')).toEqual({ kind: 'unknown', path: '/foo/bar' });
		});
	});

	describe('NAV-AC-2: History management and resumePath persistence', () => {
		it('navigates to workflow routes and updates resumePath and title', () => {
			initRouter();

			navigate('/target');
			expect($route.get()).toEqual({ kind: 'workflow', path: '/target', section: 2 });
			expect($appState.get().resumePath).toBe('/target');
			expect(document.title).toBe('samatā.ml | Set Target');

			navigate('/models/2');
			expect($route.get()).toEqual({
				kind: 'workflow',
				path: '/models/2',
				section: 3,
				modelNum: 2
			});
			expect($appState.get().resumePath).toBe('/models/2');
			expect(document.title).toBe('samatā.ml | Model 2');
		});

		it('never writes reserved paths into resumePath in $appState', () => {
			initRouter();

			navigate('/models');
			expect($appState.get().resumePath).toBe('/models');

			openReserved('/about');
			expect($route.get()).toEqual({
				kind: 'reserved',
				path: '/about',
				underlayPath: '/models'
			});
			expect(document.title).toBe('samatā.ml | About');

			// resumePath MUST remain untouched
			expect($appState.get().resumePath).toBe('/models');

			// Opening another reserved route replaces and also never touches resumePath
			openReserved('/privacy');
			expect($route.get()).toEqual({
				kind: 'reserved',
				path: '/privacy',
				underlayPath: '/models'
			});
			expect($appState.get().resumePath).toBe('/models');
		});

		it('treats duplicate navigation as a no-op without adding history entries', () => {
			initRouter();

			navigate('/target');
			const initialLength = window.history.length;

			navigate('/target');
			expect(window.history.length).toBe(initialLength);
		});

		it('generates canonical document titles per page', () => {
			expect(getDocumentTitle({ kind: 'root' })).toBe('samatā.ml');
			expect(getDocumentTitle({ kind: 'workflow', path: '/data', section: 1 })).toBe(
				'samatā.ml | Load Data'
			);
			expect(getDocumentTitle({ kind: 'workflow', path: '/target', section: 2 })).toBe(
				'samatā.ml | Set Target'
			);
			expect(getDocumentTitle({ kind: 'workflow', path: '/models', section: 3 })).toBe(
				'samatā.ml | Train Models'
			);
			expect(
				getDocumentTitle({ kind: 'workflow', path: '/models/3', section: 3, modelNum: 3 })
			).toBe('samatā.ml | Model 3');
			expect(getDocumentTitle({ kind: 'workflow', path: '/results', section: 4 })).toBe(
				'samatā.ml | Compare Results'
			);
			expect(getDocumentTitle({ kind: 'reserved', path: '/about' })).toBe(
				'samatā.ml | About'
			);
			expect(getDocumentTitle({ kind: 'reserved', path: '/privacy' })).toBe(
				'samatā.ml | Privacy'
			);
			expect(getDocumentTitle({ kind: 'reserved', path: '/help' })).toBe('samatā.ml | Help');
			expect(getDocumentTitle({ kind: 'reserved', path: '/help/configure-model' })).toBe(
				'samatā.ml | What do these settings mean?'
			);
		});
	});

	describe('NAV-AC-4: Scroll memory and viewport-width validation', () => {
		it('computes correct scroll snapshot keys for workflow routes', () => {
			expect(
				getScrollKeyForRoute({ kind: 'workflow', path: '/data', section: 1 }, 'select')
			).toBe('data:select');
			expect(
				getScrollKeyForRoute({ kind: 'workflow', path: '/data', section: 1 }, 'preview')
			).toBe('data:preview');
			expect(getScrollKeyForRoute({ kind: 'workflow', path: '/target', section: 2 })).toBe(
				'target'
			);
			expect(getScrollKeyForRoute({ kind: 'workflow', path: '/models', section: 3 })).toBe(
				'models'
			);
			expect(
				getScrollKeyForRoute({
					kind: 'workflow',
					path: '/models/4',
					section: 3,
					modelNum: 4
				})
			).toBe('models/4');
			expect(getScrollKeyForRoute({ kind: 'workflow', path: '/results', section: 4 })).toBe(
				'results'
			);
			expect(getScrollKeyForRoute({ kind: 'reserved', path: '/about' })).toBeNull();
			expect(getScrollKeyForRoute({ kind: 'root' })).toBeNull();
		});

		it('restores scroll offset when window.innerWidth matches the snapshot viewportWidth', async () => {
			const currentWidth = window.innerWidth;
			let scrolledTo: { top: number; behavior: string } | null = null;
			window.scrollTo = (options: any) => {
				scrolledTo = options;
			};

			const snapshot: ScrollSnapshot = {
				viewportWidth: currentWidth,
				top: 450,
				savedAt: Date.now()
			};

			$scrollState.set({
				version: 1,
				snapshots: { target: snapshot }
			});

			const restored = await restoreScroll('target');
			expect(restored).toBe(true);
			expect(scrolledTo as unknown).toEqual({ top: 450, behavior: 'instant' });
		});

		it('ignores snapshot without deleting it when viewport width differs', async () => {
			let scrolledTo: { top: number; behavior: string } | null = null;
			window.scrollTo = (options: any) => {
				scrolledTo = options;
			};

			const snapshot: ScrollSnapshot = {
				viewportWidth: window.innerWidth + 200, // Different width
				top: 800,
				savedAt: Date.now()
			};

			$scrollState.set({
				version: 1,
				snapshots: { models: snapshot }
			});

			const restored = await restoreScroll('models');
			expect(restored).toBe(false);
			// Left or reset to top
			expect(scrolledTo as unknown).toEqual({ top: 0, behavior: 'instant' });
			// Snapshot is preserved in store (not deleted), so rotating back makes it valid again (§8.3)
			expect($scrollState.get().snapshots.models).toEqual(snapshot);
		});

		it('aborts restoration immediately if user inputs scroll events before completion', async () => {
			let scrolledTo: { top: number; behavior: string } | null = null;
			window.scrollTo = (options: any) => {
				scrolledTo = options;
			};

			const snapshot: ScrollSnapshot = {
				viewportWidth: window.innerWidth,
				top: 600,
				savedAt: Date.now()
			};

			$scrollState.set({
				version: 1,
				snapshots: { results: snapshot }
			});

			// Simulate async view settlement
			let resolveSettled!: () => void;
			const whenSettled = new Promise<void>((resolve) => {
				resolveSettled = resolve;
			});

			const restorePromise = restoreScroll('results', whenSettled);

			// User moves wheel during async settlement
			window.dispatchEvent(new Event('wheel'));

			resolveSettled();
			const restored = await restorePromise;

			expect(restored).toBe(false);
			expect(scrolledTo).toBeNull();
		});
	});

	describe('SNC-8: Focus request lifecycle', () => {
		it('returns true once on navigate, false subsequently, and false for modal cycles', () => {
			initRouter();
			navigate('/target');
			expect(takeFocusRequest()).toBe(true);
			expect(takeFocusRequest()).toBe(false);

			stopRouter();
			window.history.replaceState(null, '', '/models');
			initRouter();
			expect(takeFocusRequest()).toBe(false);

			openReserved('/about');
			expect(takeFocusRequest()).toBe(false);

			closeReserved();
			expect(takeFocusRequest()).toBe(false);
		});
	});

	describe('SNC-9: Popstate focus request rules', () => {
		it('sets focus request on workflow-to-workflow popstate, not on reserved-to-workflow popstate', () => {
			initRouter();
			navigate('/data');
			navigate('/target');
			expect(takeFocusRequest()).toBe(true);

			// Popstate workflow -> workflow
			window.history.replaceState({ v: 1, entryId: '1' }, '', '/data');
			window.dispatchEvent(new PopStateEvent('popstate'));
			expect(takeFocusRequest()).toBe(true);
			expect(takeFocusRequest()).toBe(false);

			// Open reserved modal
			openReserved('/about');
			expect(takeFocusRequest()).toBe(false);

			// Popstate reserved -> workflow
			window.history.replaceState({ v: 1, entryId: '2' }, '', '/data');
			window.dispatchEvent(new PopStateEvent('popstate'));
			expect(takeFocusRequest()).toBe(false);
		});
	});

	describe('SNC-10: Reserved route underlayPath', () => {
		it('sets underlayPath from current route on openReserved and from resumePath on direct initRouter', () => {
			initRouter();
			navigate('/target');
			openReserved('/about');
			expect($route.get()).toEqual({
				kind: 'reserved',
				path: '/about',
				underlayPath: '/target'
			});

			stopRouter();
			$appState.set({ ...INITIAL_APP_STATE, resumePath: '/models/2' });
			window.history.replaceState(null, '', '/help');
			initRouter();
			expect($route.get()).toEqual({
				kind: 'reserved',
				path: '/help',
				underlayPath: '/models/2'
			});
		});
	});

	describe('SNC-11: History writes flush pending persister timers', () => {
		it('writes pending debounced state to storage before pushState is executed', () => {
			const storage = new MemoryStorage();
			initPersister(storage, { debounceFieldMs: 10_000 });

			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			chooseModel(1, 'logreg');
			setHyperparameters(1, { mode: 'manual', values: {} });
			flushNow();

			initRouter();

			// Make a debounced change (only values change, mode stays 'manual')
			setHyperparameters(1, { mode: 'manual', values: { C: 0.5 } });

			// Before pushState, memory storage has empty values
			const beforeRaw = storage.getItem(STATE_STORAGE_KEY);
			expect(beforeRaw).not.toBeNull();
			const beforeStored = JSON.parse(beforeRaw!);
			expect(beforeStored.models[0].hyperparameters.values).toEqual({});

			let storedValueDuringPush: any = null;
			const originalPushState = window.history.pushState;
			window.history.pushState = function (...args) {
				const raw = storage.getItem(STATE_STORAGE_KEY);
				if (raw) {
					storedValueDuringPush = JSON.parse(raw);
				}
				return originalPushState.apply(this, args);
			};

			try {
				navigate('/models');
				expect(storedValueDuringPush).not.toBeNull();
				expect(storedValueDuringPush.models[0].hyperparameters.values).toEqual({ C: 0.5 });
			} finally {
				window.history.pushState = originalPushState;
			}
		});
	});

	describe('SNC-16: Click interceptor and composedPath', () => {
		it('navigates on same-origin anchor click inside composedPath, ignoring external/download/modifier/target/hash', () => {
			initRouter();
			navigate('/data');
			takeFocusRequest();

			// 1. Same-origin link click via composedPath
			const anchor = document.createElement('a');
			anchor.href = '/target';
			document.body.appendChild(anchor);

			const event = new MouseEvent('click', { bubbles: true, cancelable: true });
			anchor.dispatchEvent(event);
			expect($route.get().kind).toBe('workflow');
			expect(($route.get() as any).path).toBe('/target');

			// 2. Download link ignored
			anchor.setAttribute('download', 'file.csv');
			anchor.href = '/data';
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			expect(($route.get() as any).path).toBe('/target'); // Still /target
			anchor.removeAttribute('download');

			// 3. Target _blank ignored
			anchor.setAttribute('target', '_blank');
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			expect(($route.get() as any).path).toBe('/target');
			anchor.removeAttribute('target');

			// 4. Hash-only link ignored
			anchor.setAttribute('href', '#anchor');
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			expect(($route.get() as any).path).toBe('/target');

			// 5. Modifier key ignored
			anchor.setAttribute('href', '/data');
			anchor.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
			);
			expect(($route.get() as any).path).toBe('/target');

			// 6. External link ignored
			anchor.setAttribute('href', 'https://example.com/external');
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			expect(($route.get() as any).path).toBe('/target');

			document.body.removeChild(anchor);
		});
	});

	function setScrollY(val: number): void {
		Object.defineProperty(window, 'scrollY', {
			value: val,
			configurable: true,
			writable: true
		});
		if (document.documentElement) {
			document.documentElement.scrollTop = val;
		}
	}

	describe('SNC-12: Scroll saving for active key only', () => {
		it('records scroll updates for active key only, and records nothing before first restoreScroll', async () => {
			initScrollRestorer();

			// Scroll before any restoreScroll records nothing
			setScrollY(150);
			window.dispatchEvent(new Event('scroll'));
			expect(Object.keys($scrollState.get().snapshots)).toHaveLength(0);

			// Activate key 'target' via restoreScroll
			await restoreScroll('target');
			expect(getActiveKey()).toBe('target');
			expect(getSavingEnabled()).toBe(true);

			// Dispatch scroll event -> recorded under 'target'
			setScrollY(350);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots.target?.top).toBe(350);
			expect($scrollState.get().snapshots['data:select']).toBeUndefined();
			expect($scrollState.get().snapshots.models).toBeUndefined();
		});
	});

	describe('SNC-13: restoreScroll exit paths leave saving enabled', () => {
		it('leaves saving enabled on matching width restore', async () => {
			initScrollRestorer();
			$scrollState.set({
				version: 1,
				snapshots: {
					target: { viewportWidth: window.innerWidth, top: 400, savedAt: Date.now() }
				}
			});

			const restored = await restoreScroll('target');
			expect(restored).toBe(true);
			expect(getSavingEnabled()).toBe(true);

			setScrollY(420);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots.target?.top).toBe(420);
		});

		it('leaves saving enabled on mismatching width restore', async () => {
			initScrollRestorer();
			$scrollState.set({
				version: 1,
				snapshots: {
					models: {
						viewportWidth: window.innerWidth + 300,
						top: 500,
						savedAt: Date.now()
					}
				}
			});

			const restored = await restoreScroll('models');
			expect(restored).toBe(false);
			expect(getSavingEnabled()).toBe(true);

			setScrollY(220);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots.models?.top).toBe(220);
		});

		it('leaves saving enabled when aborted by wheel input', async () => {
			initScrollRestorer();
			$scrollState.set({
				version: 1,
				snapshots: {
					results: { viewportWidth: window.innerWidth, top: 600, savedAt: Date.now() }
				}
			});

			let resolveSettled!: () => void;
			const whenSettled = new Promise<void>((resolve) => {
				resolveSettled = resolve;
			});

			const restorePromise = restoreScroll('results', whenSettled);
			window.dispatchEvent(new Event('wheel'));
			resolveSettled();

			const restored = await restorePromise;
			expect(restored).toBe(false);
			expect(getSavingEnabled()).toBe(true);

			setScrollY(260);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots.results?.top).toBe(260);
		});

		it('leaves saving enabled when no snapshot exists', async () => {
			initScrollRestorer();
			clearScroll();

			const restored = await restoreScroll('data:preview');
			expect(restored).toBe(false);
			expect(getSavingEnabled()).toBe(true);

			setScrollY(310);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots['data:preview']?.top).toBe(310);
		});

		it('leaves saving enabled when restoration promise throws', async () => {
			initScrollRestorer();
			clearScroll();
			$scrollState.set({
				version: 1,
				snapshots: {
					target: { viewportWidth: window.innerWidth, top: 100, savedAt: Date.now() }
				}
			});

			const crashingPromise = Promise.reject(new Error('Layout crash'));
			// Suppress unhandled rejection in test
			crashingPromise.catch(() => {});

			let caughtError: any = null;
			try {
				await restoreScroll('target', crashingPromise);
			} catch (err) {
				caughtError = err;
			}
			expect(caughtError).not.toBeNull();
			expect(caughtError.message).toBe('Layout crash');
			expect(getSavingEnabled()).toBe(true);

			setScrollY(390);
			window.dispatchEvent(new Event('scroll'));
			expect($scrollState.get().snapshots.target?.top).toBe(390);
		});
	});
});
