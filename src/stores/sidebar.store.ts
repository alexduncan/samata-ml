import { computed } from 'nanostores';
import { $route } from '../router/router';
import { $appState } from './app.store';

/** Read-only sidebar summaries and link states, derived without changing domain state. */
export const $sidebarState = computed([$appState, $route], (state, route) => {
	const path = route.kind === 'workflow' ? route.path : null;
	const current = (href: string): 'page' | undefined => (path === href ? 'page' : undefined);
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
			status: model.status,
			current: current(`/models/${model.num}`)
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
