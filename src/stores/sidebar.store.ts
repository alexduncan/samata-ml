import { computed } from 'nanostores';
import { $route, getEffectiveWorkflowRoute } from '../router/router';
import { $appState, modelSwatchAssignments } from './app.store';
import { savedModelName } from '../features/models/model-catalogue';

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
