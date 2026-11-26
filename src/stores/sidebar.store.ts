import { atom, computed, type ReadableAtom } from 'nanostores';
import { $route, getEffectiveWorkflowRoute } from '../router/router';
import { $appState, modelSwatchAssignments } from './app.store';
import { savedModelName } from '../features/models/model-catalogue';
import type { ParsedRoute } from '../types/routes';
import type { PersistedAppState } from '../types/state';

type ModelCue = 'train-new' | 'train-another' | 'results';
type WorkflowCue = 'data' | 'target' | ModelCue;

function cueSnapshot(state: PersistedAppState, route: ParsedRoute) {
	return {
		dataset: state.dataset?.id ?? null,
		target: state.target,
		epoch: state.comparisonContextEpoch,
		trained: state.models.filter(({ status }) => status === 'trained').length,
		path:
			route.kind === 'workflow'
				? route.path
				: ((route.kind === 'reserved' ? route.underlayPath : undefined) ?? state.resumePath)
	};
}

/** Tracks suggested workflow links for one connected sidebar, without persisting milestones. */
export function createSidebarCueTracker() {
	const writableCue = atom<WorkflowCue | null>(null);
	let unlisten: (() => void)[] | undefined;

	function start(): void {
		if (unlisten) return;
		let state = $appState.get();
		let route = $route.get();
		let previous = cueSnapshot(state, route);
		let highWater = previous.trained;
		let pending: ModelCue | null = null;

		function publish(): void {
			const { dataset, target, path } = previous;
			const cue =
				dataset === null
					? path === '/data'
						? null
						: 'data'
					: target === null
						? path === '/target'
							? null
							: 'target'
						: pending === 'train-another' && path === '/models/new'
							? null
							: pending;
			writableCue.set(cue);
		}

		function update(): void {
			const next = cueSnapshot(state, route);
			const { dataset, target, epoch, path, trained } = next;
			const selectedTarget = dataset !== previous.dataset || target !== previous.target;
			const contextChanged = selectedTarget || epoch !== previous.epoch;
			if (contextChanged || dataset === null || target === null) {
				highWater = trained;
				pending =
					dataset !== null && target !== null && selectedTarget && trained === 0
						? 'train-new'
						: null;
			} else {
				if (path === '/models/new' && previous.path !== path && pending === 'train-another')
					pending = null;
				if (trained >= 2 && highWater < 2) pending = 'results';
				else if (trained === 1 && highWater === 0) pending = 'train-another';
				highWater = Math.max(highWater, trained);
				if (previous.path === '/models/new' && path !== previous.path && highWater === 0)
					pending = 'train-new';
			}

			if (
				(pending === 'train-new' && path === '/models/new') ||
				(pending === 'train-another' && trained === 0) ||
				(pending === 'results' && (trained < 2 || path === '/results'))
			)
				pending = null;
			previous = next;
			publish();
		}

		unlisten = [
			$appState.listen((value) => {
				state = value;
				update();
			}),
			$route.listen((value) => {
				route = value;
				update();
			})
		];
		publish();
	}

	function stop(): void {
		unlisten?.forEach((remove) => remove());
		unlisten = undefined;
		writableCue.set(null);
	}

	return { cue: writableCue as ReadableAtom<WorkflowCue | null>, start, stop };
}

/** Read-only sidebar summaries and link states, derived without changing domain state. */
export const $sidebarState = computed([$appState, $route], (state, route) => {
	const path = route.kind === 'workflow' ? route.path : null;
	const current = (href: string): 'page' | undefined => (path === href ? 'page' : undefined);
	const underlay = getEffectiveWorkflowRoute(route);
	const { colours } = modelSwatchAssignments(state);
	const trained = state.models
		.filter(({ status }) => status === 'trained')
		.sort((a, b) => a.num - b.num);
	return {
		dataset: state.dataset
			? {
					name: state.dataset.name,
					rows: state.dataset.rowCount,
					columns: state.dataset.columns.length
				}
			: null,
		target: state.target
			? {
					name: state.target,
					type:
						state.dataset?.columns.find((column) => column.name === state.target)
							?.type ?? null
				}
			: null,
		canTrain: state.dataset !== null && state.target !== null,
		provisionalVisible: underlay.kind === 'workflow' && underlay.path === '/models/new',
		models: trained.map((model) => ({
			num: model.num,
			name: savedModelName(model),
			featureCount: model.features?.length,
			colour: colours.get(model.num)!,
			current: current(`/models/${model.num}`)
		})),
		current: {
			data: current('/data'),
			target: current('/target'),
			models:
				current('/models') ??
				(route.kind === 'workflow' && route.section === 3 ? ('true' as const) : undefined),
			provisional: current('/models/new'),
			results: current('/results')
		}
	};
});
