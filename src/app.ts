import { html, render } from 'lit';
import './components/app-model-card';
import './features/data/app-data-view';
import './features/models/app-model-builder-view';
import './features/models/app-model-description-dialog';
import './features/models/app-models-view';
import './features/navigation/app-content-modal';
import './features/navigation/app-sidebar';
import './features/onboarding/app-welcome-modal';
import './features/target/app-target-view';
import { parseRoute } from './router/route-parser';
import { $route, initRouter, takeFocusRequest } from './router/router';
import { getScrollKeyForRoute, initScrollRestorer, restoreScroll } from './router/scroll-restorer';
import { $appState } from './stores/app.store';
import { $datasetResources } from './stores/dataset.store';
import { initPersister } from './stores/persister';
import { createDefaultIndexedDBAdapter, reconcileStartupState } from './stores/reconciler';
import { initGlobalStyles } from './styles/global';
import type { ParsedRoute, WorkflowPath } from './types/routes';

let lastRestoredScrollKey: string | null = null;

declare global {
	interface Window {
		__appState?: typeof $appState;
		__datasetResources?: typeof $datasetResources;
	}
}

if (typeof window !== 'undefined') {
	window.__appState = $appState;
	window.__datasetResources = $datasetResources;
}

/**
 * Returns the template for a workflow route view.
 */
function renderWorkflowView(route: ParsedRoute) {
	if (route.kind !== 'workflow') {
		return html``;
	}

	switch (route.path) {
		case '/data':
			return html` <app-data-view></app-data-view> `;
		case '/target':
			return html` <app-target-view></app-target-view> `;
		case '/models':
			return html` <app-models-view></app-models-view> `;
		case '/results':
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Compare Results</h1>
					<p class="description">Compare performance metrics across trained models.</p>
				</div>
				<section class="page-body" data-testid="results-view">
					<p>Model comparison view placeholder.</p>
				</section>
			`;
		default:
			if (route.modelNum !== undefined) {
				return html`
					<app-model-builder-view model-num=${route.modelNum}></app-model-builder-view>
				`;
			}
			return html``;
	}
}

/**
 * Resolves the active workflow route to display in <main>, keeping underlay mounted during reserved modals.
 */
function getActiveWorkflowRoute(currentRoute: ParsedRoute): ParsedRoute {
	if (currentRoute.kind === 'workflow') {
		return currentRoute;
	}
	const resume = $appState.get().resumePath || '/data';
	if (currentRoute.kind === 'reserved') {
		const underlay = currentRoute.underlayPath ?? resume;
		return parseRoute(underlay);
	}
	return parseRoute(resume);
}

/**
 * Renders the application shell into the container.
 */
export function renderAppShell(container: HTMLElement): void {
	const currentRoute = $route.get();
	const activeWorkflowRoute = getActiveWorkflowRoute(currentRoute);

	const template = html`
		<style>
			#app-container {
				display: flex;
				min-height: 100vh;
			}
			#content {
				flex: 1;
				box-sizing: border-box;
				margin-left: var(--sidebar-width, 260px);
				padding: var(--space-6, 1.5rem) var(--space-8, 2rem);
				min-height: 100vh;
			}
			.page-header h1 {
				margin-top: 0;
				outline: none;
				color: var(--color-primary, #0f172a);
				font-weight: 700;
				font-size: var(--text-2xl, 1.75rem);
			}
			.page-header .description {
				margin: var(--space-1, 0.25rem) 0 var(--space-6, 1.5rem) 0;
				color: var(--color-text-muted, #64748b);
			}
		</style>

		<div id="app-container">
			<app-sidebar></app-sidebar>
			<main id="content" role="main">${renderWorkflowView(activeWorkflowRoute)}</main>
			<app-welcome-modal></app-welcome-modal>
			<app-content-modal></app-content-modal>
		</div>
	`;

	render(template, container);

	// Focus handling on user workflow navigation per §5.6
	const requestedFocus = takeFocusRequest();
	if (requestedFocus && currentRoute.kind === 'workflow') {
		const h1 = container.querySelector<HTMLElement>('#content h1');
		if (h1) {
			h1.focus({ preventScroll: true });
		}
	}

	// Trigger scroll restoration only when scroll key changes (D13)
	if (currentRoute.kind === 'workflow') {
		const dataMode = $appState.get().data.mode;
		const scrollKey = getScrollKeyForRoute(currentRoute, dataMode);
		if (scrollKey && scrollKey !== lastRestoredScrollKey) {
			lastRestoredScrollKey = scrollKey;
			const viewEl = container.querySelector('app-data-view');
			const settled = viewEl && 'whenSettled' in viewEl ? viewEl.whenSettled() : undefined;
			restoreScroll(scrollKey, settled);
		}
	}
}

/**
 * Bootstraps the full application runtime.
 */
export async function bootstrapApp(): Promise<void> {
	initGlobalStyles();

	// 1. Reconcile storage and IndexedDB
	await reconcileStartupState(undefined, createDefaultIndexedDBAdapter());

	// 2. Initialize persistence persister
	initPersister();

	// 3. Initialize scroll restorer
	initScrollRestorer();

	// 4. Initialize router
	initRouter();

	// 5. Mount root shell
	const root = document.getElementById('app');
	if (root) {
		renderAppShell(root);
		// Subscribe to route changes to re-render views dynamically
		$route.subscribe(() => {
			renderAppShell(root);
		});
		let prevMode = $appState.get().data.mode;
		$appState.subscribe((state) => {
			if (state.data.mode !== prevMode) {
				prevMode = state.data.mode;
				renderAppShell(root);
			}
		});
	}
}

// Auto-bootstrap in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
	const root = document.getElementById('app');
	if (root) {
		bootstrapApp();
	}
}
