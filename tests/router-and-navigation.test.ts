import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { parseRoute } from '../src/router/route-parser';
import {
	$route,
	navigate,
	openReserved,
	closeReserved,
	initRouter,
	stopRouter,
	getDocumentTitle
} from '../src/router/router';
import {
	getScrollKeyForRoute,
	recordCurrentScroll,
	restoreScroll,
	initScrollRestorer,
	stopScrollRestorer
} from '../src/router/scroll-restorer';
import { $appState, setResumePath } from '../src/stores/app.store';
import { $scrollState, clearScroll } from '../src/stores/scroll.store';
import { INITIAL_APP_STATE, type ScrollSnapshot } from '../src/types/state';

describe('Router & Navigation (NAV-AC-1, NAV-AC-2, NAV-AC-4)', () => {
	beforeEach(() => {
		stopRouter();
		stopScrollRestorer();
		$appState.set({ ...INITIAL_APP_STATE });
		clearScroll();
		window.history.replaceState(null, '', '/data');
	});

	afterEach(() => {
		stopRouter();
		stopScrollRestorer();
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

		it('parses reserved paths correctly', () => {
			expect(parseRoute('/about')).toEqual({ kind: 'reserved', path: '/about' });
			expect(parseRoute('/privacy')).toEqual({ kind: 'reserved', path: '/privacy' });
			expect(parseRoute('/help')).toEqual({ kind: 'reserved', path: '/help' });
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
			expect($route.get()).toEqual({ kind: 'reserved', path: '/about' });
			expect(document.title).toBe('samatā.ml | About');

			// resumePath MUST remain untouched
			expect($appState.get().resumePath).toBe('/models');

			// Opening another reserved route replaces and also never touches resumePath
			openReserved('/privacy');
			expect($route.get()).toEqual({ kind: 'reserved', path: '/privacy' });
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
});
