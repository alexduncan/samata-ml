import { html, render } from 'lit';
import './features/navigation/app-content-modal';
import './features/navigation/app-sidebar';
import './features/onboarding/app-welcome-modal';
import { parseRoute } from './router/route-parser';
import { $route, initRouter } from './router/router';
import { getScrollKeyForRoute, initScrollRestorer, restoreScroll } from './router/scroll-restorer';
import { $appState } from './stores/app.store';
import { initPersister } from './stores/persister';
import { createDefaultIndexedDBAdapter, reconcileStartupState } from './stores/reconciler';
import { initGlobalStyles } from './styles/global';
import type { ParsedRoute, WorkflowPath } from './types/routes';

/**
 * Returns the template for a workflow route view.
 */
function renderWorkflowView(route: ParsedRoute) {
	if (route.kind !== 'workflow') {
		return html``;
	}

	switch (route.path) {
		case '/data':
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Load Data</h1>
					<p class="description">
						Select a sample dataset or upload your own CSV file to begin.
					</p>
				</div>
				<section class="page-body" data-testid="data-view">
					<p>Dataset ingestion view placeholder.</p>
				</section>
			`;
		case '/target':
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Set Target</h1>
					<p class="description">
						Choose the target column you want your models to predict.
					</p>
				</div>
				<section class="page-body" data-testid="target-view">
					<p>Target selection view placeholder.</p>
				</section>
			`;
		case '/models':
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Train Models</h1>
					<p class="description">Configure features and train machine learning models.</p>
				</div>
				<section class="page-body" data-testid="models-view">
					<p>Model training table placeholder.</p>
				</section>
			`;
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
					<div class="page-header">
						<h1 tabindex="-1">Model ${route.modelNum}</h1>
						<p class="description">
							Configure architecture, features, and hyperparameters for Model
							${route.modelNum}.
						</p>
					</div>
					<section class="page-body" data-testid="model-detail-view">
						<p>Model ${route.modelNum} builder placeholder.</p>
					</section>
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
	if (currentRoute.kind === 'reserved') {
		const resume = $appState.get().resumePath || '/data';
		return parseRoute(resume);
	}
	const fallback = $appState.get().resumePath || '/data';
	return parseRoute(fallback);
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
	if (currentRoute.kind === 'workflow') {
		queueMicrotask(() => {
			const h1 = container.querySelector<HTMLElement>('#content h1');
			if (h1 && document.activeElement !== h1) {
				h1.focus({ preventScroll: true });
			}
		});

		// Trigger scroll restoration
		const dataMode = $appState.get().data.mode;
		const scrollKey = getScrollKeyForRoute(currentRoute, dataMode);
		if (scrollKey) {
			restoreScroll(scrollKey);
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
	}
}

// Auto-bootstrap in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
	const root = document.getElementById('app');
	if (root) {
		bootstrapApp();
	}
}
