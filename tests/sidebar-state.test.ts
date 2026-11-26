import { afterEach, expect, test } from 'bun:test';
import { $appState } from '../src/stores/app.store';
import { $sidebarState } from '../src/stores/sidebar.store';
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
