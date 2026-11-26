import { afterEach, expect, test } from 'bun:test';
import { atom } from 'nanostores';
import { $appState } from '../src/stores/app.store';
import { $sidebarState, createSidebarCueTracker } from '../src/stores/sidebar.store';
import { $route } from '../src/router/router';
import { parseRoute } from '../src/router/route-parser';
import { createSidebarFixture } from './visual-parity/fixtures';

const initialState = $appState.get();
const initialRoute = $route.get();
afterEach(() => {
	$appState.set(initialState);
	$route.set(initialRoute);
});

test('SIDE-STATE-1: empty and incomplete summaries are safe and never mutate source state', () => {
	const empty = createSidebarFixture('empty');
	$appState.set(empty);
	$route.set(parseRoute('/data'));
	expect($sidebarState.get()).toMatchObject({
		dataset: null,
		target: null,
		models: [],
		current: { data: 'page' }
	});
	const state = createSidebarFixture('models');
	state.target = 'missing-column';
	const before = structuredClone(state);
	$appState.set(state);
	expect($sidebarState.get().target).toEqual({ name: 'missing-column', type: null });
	expect($sidebarState.get().dataset).toEqual({ name: 'Palmer Penguins', rows: 344, columns: 9 });
	expect(state).toEqual(before);
});

test('SIDE-STATE-1: exact workflow, model parent/detail and reserved link states follow the route', () => {
	$appState.set(createSidebarFixture('models'));
	for (const [path, key] of [
		['/data', 'data'],
		['/target', 'target'],
		['/models', 'models'],
		['/results', 'results']
	] as const) {
		$route.set(parseRoute(path));
		expect($sidebarState.get().current[key]).toBe('page');
		expect(Object.values($sidebarState.get().current).filter(Boolean)).toEqual(['page']);
	}
	$route.set(parseRoute('/models/2'));
	expect($sidebarState.get().current.models).toBe('true');
	expect($sidebarState.get().models.map((model) => model.current)).toEqual([undefined, 'page']);
	$route.set(parseRoute('/about'));
	expect(Object.values($sidebarState.get().current).every((value) => value === undefined)).toBe(
		true
	);
	expect($sidebarState.get().models.every((model) => model.current === undefined)).toBe(true);
});

test('MW-MODEL-1: trained model names, colours and feature counts keep their numeric order', () => {
	const state = createSidebarFixture('models');
	const shuffled = { ...state, models: [...state.models].reverse() };
	$appState.set(shuffled);
	$route.set(parseRoute('/models/new'));
	expect($sidebarState.get()).toMatchObject({
		canTrain: true,
		provisionalVisible: true,
		models: [
			{ num: 1, name: 'Logistic Regression', colour: 'amber', featureCount: 1 },
			{ num: 2, name: 'Decision Tree', colour: 'blue', featureCount: 2 }
		],
		current: { models: 'true', provisional: 'page' }
	});
	$route.set({ kind: 'reserved', path: '/help', underlayPath: '/models/new' });
	expect($sidebarState.get()).toMatchObject({
		provisionalVisible: true,
		current: { models: undefined, provisional: undefined }
	});
	expect(shuffled.models.map(({ num }) => num)).toEqual([3, 2, 1]);
});

test('DOT-AC-1: prerequisite cues follow the effective path and reset with sidebar reconnection', () => {
	$appState.set(createSidebarFixture('empty'));
	$route.set(parseRoute('/data'));
	const tracker = createSidebarCueTracker();
	tracker.start();
	try {
		expect(tracker.cue.get()).toBeNull();
		$route.set({ kind: 'reserved', path: '/help', underlayPath: '/target' });
		expect(tracker.cue.get()).toBe('data');
		$appState.set(createSidebarFixture('dataset'));
		expect(tracker.cue.get()).toBeNull();
		$route.set({ kind: 'reserved', path: '/help', underlayPath: '/data' });
		expect(tracker.cue.get()).toBe('target');
		tracker.stop();
		$appState.set(createSidebarFixture('target'));
		expect(tracker.cue.get()).toBeNull();
		tracker.start();
		expect(tracker.cue.get()).toBeNull();
	} finally {
		tracker.stop();
	}
});

test('DOT-AC-3: reduce captured route and state notifications in queue order', () => {
	const models = createSidebarFixture('models');
	$appState.set(createSidebarFixture('target'));
	$route.set(parseRoute('/models'));
	const tracker = createSidebarCueTracker();
	tracker.start();
	const observed: (string | null)[] = [];
	const unsubscribe = tracker.cue.listen((value) => observed.push(value));
	const queue = atom(false);
	const release = queue.listen(() => {
		$route.set(parseRoute('/models/new'));
		$appState.set({ ...models, models: models.models.slice(0, 1) });
		$route.set(parseRoute('/models/1'));
		$route.set(parseRoute('/models/new'));
		$appState.set({ ...models, models: models.models.slice(0, 2) });
		$route.set(parseRoute('/results'));
		$route.set(parseRoute('/models/1'));
	});
	try {
		queue.set(true);
		expect(observed).toEqual(['train-another', null, 'results', null]);
		expect(tracker.cue.get()).toBeNull();
	} finally {
		release();
		unsubscribe();
		tracker.stop();
	}
});

test('DOT-AC-3: demotion retires a hidden first success without replay on departure or recovery', () => {
	const models = createSidebarFixture('models');
	const one = { ...models, models: models.models.slice(0, 1) };
	const untrained = { ...models, models: [models.models[2]!] };
	$appState.set(untrained);
	$route.set(parseRoute('/models/new'));
	const tracker = createSidebarCueTracker();
	tracker.start();
	try {
		$appState.set({ ...untrained, models: [{ ...untrained.models[0]!, status: 'draft' }] });
		expect(tracker.cue.get()).toBeNull();
		$appState.set(one);
		expect(tracker.cue.get()).toBeNull();
		$route.set({ kind: 'reserved', path: '/help', underlayPath: '/models/new' });
		$appState.set(untrained);
		$route.set(parseRoute('/models'));
		expect(tracker.cue.get()).toBeNull();
		$appState.set(one);
		expect(tracker.cue.get()).toBeNull();
		$appState.set(models);
		expect(tracker.cue.get()).toBe('results');
		$appState.set(one);
		$appState.set(models);
		expect(tracker.cue.get()).toBeNull();
		$appState.set({
			...models,
			target: 'island',
			comparisonContextEpoch: models.comparisonContextEpoch + 1,
			models: []
		});
		expect(tracker.cue.get()).toBe('train-new');
	} finally {
		tracker.stop();
	}
});

test('DOT-AC-3: a zero-to-two publication suggests only results, but hydration seeds the new context', () => {
	const models = createSidebarFixture('models');
	$appState.set(createSidebarFixture('target'));
	$route.set(parseRoute('/models'));
	const tracker = createSidebarCueTracker();
	tracker.start();
	try {
		$appState.set(models);
		expect(tracker.cue.get()).toBe('results');
		const replacement = {
			...models,
			comparisonContextEpoch: models.comparisonContextEpoch + 1
		};
		$appState.set(replacement);
		expect(tracker.cue.get()).toBeNull();
		$appState.set({
			...replacement,
			models: [...models.models, { ...models.models[0]!, num: 4 }]
		});
		expect(tracker.cue.get()).toBeNull();
	} finally {
		tracker.stop();
	}
});
