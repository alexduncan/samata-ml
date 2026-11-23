import { html, nothing, render } from 'lit';
import './features/models/app-model-card';
import './features/data/app-data-view';
import './features/models/app-model-builder-view';
import './features/models/app-model-description-dialog';
import './features/models/app-models-view';
import './features/shell/app-content-modal';
import './features/shell/app-sidebar';
import './features/shell/app-welcome-modal';
import './features/target/app-target-view';
import { parseRoute } from './router/route-parser';
import { $route, initRouter, takeFocusRequest } from './router/router';
import { getScrollKeyForRoute, initScrollRestorer, restoreScroll } from './router/scroll-restorer';
import { $appState } from './stores/app.store';
import { $datasetResources } from './stores/dataset.store';
import { $storageSaveNotice, initPersister, refreshTrainingSnapshot } from './stores/persister';
import { reconcileProtectedStartup } from './stores/reconciler';
import { initGlobalStyles } from './styles/global';
import { i18n } from './i18n';
import { STATE_STORAGE_KEY } from './types/state';
import {
	$publicationPending,
	getTrainingService
} from './features/models/training/training-service';
import type { ParsedRoute, WorkflowPath } from './types/routes';

let lastRestoredScrollKey: string | null = null;
let pendingHeadingFocus: AbortController | undefined;
let startupRecovery = false;
let retryingStartup = false;
let retryingDatasetPublication = false;
const storageMessages = i18n('app-shell-storage', {
	title: 'Restore saved work',
	startup: 'Your saved work could not be restored. Retry saving.',
	retry: 'Retry saving',
	retrying: 'Saving…',
	bestEffort: 'Your changes could not be saved. They are available in this tab.',
	datasetPending: 'The dataset is saved, but finishing is pending. Retry saving.'
});

async function retryStartup(container: HTMLElement): Promise<void> {
	if (retryingStartup) return;
	retryingStartup = true;
	renderAppShell(container);
	const ack = await reconcileProtectedStartup();
	startupRecovery = !ack.ok;
	retryingStartup = false;
	renderAppShell(container);
}

type WorkflowFocusView = HTMLElementTagNameMap[
	| 'app-data-view'
	| 'app-target-view'
	| 'app-models-view'
	| 'app-model-builder-view'];

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
				<header class="page-header">
					<h1 tabindex="-1">Compare Results</h1>
					<p>Compare performance metrics across trained models.</p>
				</header>
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

async function retryDatasetPublication(container: HTMLElement): Promise<void> {
	if (retryingDatasetPublication) return;
	retryingDatasetPublication = true;
	renderAppShell(container);
	await getTrainingService().retry();
	retryingDatasetPublication = false;
	renderAppShell(container);
}

/**
 * Renders the application shell into the container.
 */
export function renderAppShell(container: HTMLElement): void {
	pendingHeadingFocus?.abort();
	pendingHeadingFocus = undefined;
	const currentRoute = $route.get();
	const activeWorkflowRoute = getActiveWorkflowRoute(currentRoute);
	const messages = storageMessages.get();

	const template = html`
		<app-sidebar></app-sidebar>
		<main id="content">
			${startupRecovery
				? html`
						<header class="page-header">
							<h1 tabindex="-1">${messages.title}</h1>
						</header>
						<section class="page-body">
							<p class="notification notification-alert" role="alert">
								${messages.startup}
							</p>
							<button
								class="btn btn-primary"
								type="button"
								?disabled=${retryingStartup}
								@click=${() => void retryStartup(container)}>
								${retryingStartup ? messages.retrying : messages.retry}
							</button>
						</section>
					`
				: html`
						${$publicationPending.get()?.kind === 'replace'
							? html`<aside>
									<p class="notification notification-alert" role="alert">
										${messages.datasetPending}
									</p>
									<button
										type="button"
										class="btn"
										?disabled=${retryingDatasetPublication}
										@click=${() => void retryDatasetPublication(container)}>
										${messages.retry}
									</button>
								</aside>`
							: nothing}
						${$storageSaveNotice.get()
							? html`<p class="notification notification-alert" role="status">
									${messages.bestEffort}
								</p>`
							: nothing}
						${renderWorkflowView(activeWorkflowRoute)}
					`}
		</main>
		${startupRecovery ? nothing : html`<app-welcome-modal></app-welcome-modal>`}
		<app-content-modal></app-content-modal>
	`;

	render(template, container);

	// Focus handling on user workflow navigation per §5.6
	const requestedFocus = takeFocusRequest();
	if (requestedFocus && currentRoute.kind === 'workflow') {
		const controller = new AbortController();
		pendingHeadingFocus = controller;
		const view = container.querySelector<WorkflowFocusView>(
			'#content > app-data-view, #content > app-target-view, #content > app-models-view, #content > app-model-builder-view'
		);
		if (view) {
			void view.focusHeading(controller.signal).finally(() => {
				if (pendingHeadingFocus === controller) pendingHeadingFocus = undefined;
			});
		} else {
			container.querySelector<HTMLElement>('#content > .page-header > h1')?.focus({
				preventScroll: true
			});
			pendingHeadingFocus = undefined;
		}
	}

	// Trigger scroll restoration only when scroll key changes (D13)
	if (currentRoute.kind === 'workflow') {
		const dataMode = $appState.get().data.mode;
		const scrollKey = getScrollKeyForRoute(currentRoute, dataMode);
		if (scrollKey && scrollKey !== lastRestoredScrollKey) {
			lastRestoredScrollKey = scrollKey;
			const viewEl = container.querySelector<
				HTMLElementTagNameMap['app-data-view' | 'app-model-builder-view']
			>('#content > app-data-view, #content > app-model-builder-view');
			const settled = viewEl?.whenSettled();
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
	const startup = await reconcileProtectedStartup();
	startupRecovery = !startup.ok;

	// 2. Initialize persistence persister
	initPersister(undefined, { trainingPersistence: {} });

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
		$storageSaveNotice.listen(() => renderAppShell(root));
		$publicationPending.listen(() => renderAppShell(root));
		getTrainingService().observePublishedStops();
		storageMessages.listen(() => renderAppShell(root));
		window.addEventListener('storage', (event) => {
			if (event.key !== STATE_STORAGE_KEY && event.key !== null) return;
			void refreshTrainingSnapshot().then((ack) => {
				if (!ack.ok) {
					startupRecovery = true;
					renderAppShell(root);
				}
			});
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
