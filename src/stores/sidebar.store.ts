import { computed } from 'nanostores';
import { $route } from '../router/router';
import { $appState } from './app.store';
import { provisionalModelIn } from '../types/state';

/** Read-only sidebar summaries and link states, derived without changing domain state. */
export const $sidebarState = computed([$appState, $route], (state, route) => {
	const path = route.kind === 'workflow' ? route.path : null;
	const current = (href: string): 'page' | undefined => (path === href ? 'page' : undefined);
	const provisional = provisionalModelIn(state.models, state.newModelNum);
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
		models: state.models.map((model) => ({
			num: model.num,
			href: model === provisional ? '/models/new' : `/models/${model.num}`,
			provisional: model === provisional ? model.createdAt : undefined,
			status: model.status,
			current: current(model === provisional ? '/models/new' : `/models/${model.num}`)
		})),
		current: {
			data: current('/data'),
			target: current('/target'),
			models:
				current('/models') ??
				(route.kind === 'workflow' && route.section === 3 ? ('true' as const) : undefined),
			results: current('/results')
		}
	};
});
