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
import './features/results/app-results-view';
import { parseRoute } from './router/route-parser';
import {
	$route,
	getEffectiveModelNum,
	getEffectiveWorkflowRoute,
	getWorkflowEntryId,
	initRouter,
	isCurrentProvisionalContext,
	provisionalRouteModel,
	retryProvisionalRoute,
	takeFocusRequest
} from './router/router';
import { getScrollKeyForRoute, initScrollRestorer, restoreScroll } from './router/scroll-restorer';
import { $appState } from './stores/app.store';
import { $datasetResources } from './stores/dataset.store';
import { blockedReason } from './stores/predicates';
import {
	$storageSaveNotice,
	adoptStoredBetaAcceptance,
	initPersister,
	refreshTrainingSnapshot
} from './stores/persister';
import { reconcileProtectedStartup } from './stores/reconciler';
import { initGlobalStyles } from './styles/global';
import { $staleAssetDetected, installStaleReleaseDetection } from './common/release/stale-release';
import { onWorkerFailure } from './common/release/worker-failures';
import {
	initBetaTelemetry,
	reportBetaException,
	syncBetaRoute
} from './common/telemetry/telemetry-client';
import { i18n } from './i18n';
import { STATE_STORAGE_KEY } from './types/state';
import {
	$publicationPending,
	getTrainingService
} from './features/models/training/training-service';
import type { ParsedRoute } from './types/routes';

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
const releaseMessages = i18n('app-shell-release', {
	message:
		'A newer version of samatā.ml is available. Reload to continue with your saved progress.',
	reload: 'Reload'
});
const provisionalMessages = i18n('app-shell-provisional', {
	title: 'Train New Model',
	loading: 'Opening your model…',
	retry: 'Retry saving',
	pending: 'Your model could not be opened. Retry saving to restore it.',
	unavailable: 'This model is unavailable from this entry.',
	models: 'Back to Models',
	dataset: 'Load a dataset',
	target: 'Choose a target',
	datasetRequired: 'Load a dataset before training a model.',
	targetRequired: 'Choose a target before training a model.'
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
	| 'app-model-builder-view'
	| 'app-results-view'];

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
		case '/models/new': {
			const provisional = route.provisional;
			if (provisional?.kind === 'bound' && provisionalRouteModel(provisional.identity)) {
				return html`
					<app-model-builder-view
						model-num=${provisional.identity.modelNum}
						.provisionalBinding=${provisional.identity}></app-model-builder-view>
				`;
			}
			return renderProvisionalPlaceholder(provisional);
		}
		case '/results':
			return html`<app-results-view></app-results-view>`;
		default:
			if (route.modelNum !== undefined) {
				return html`
					<app-model-builder-view
						model-num=${route.modelNum}
						.numberedRoute=${true}></app-model-builder-view>
				`;
			}
			return html``;
	}
}

/** Renders the pending, prerequisite or recovery view for the new-model entry. */
function renderProvisionalPlaceholder(
	provisional: Extract<ParsedRoute, { kind: 'workflow' }>['provisional']
) {
	const text = provisionalMessages.get();
	const blocked = blockedReason('/models/new', $appState.get());
	const loading =
		provisional?.kind === 'loading' && isCurrentProvisionalContext(provisional.context);
	const retry =
		provisional?.kind === 'pending' && isCurrentProvisionalContext(provisional.context);
	const datasetMissing = blocked === 'DATASET_REQUIRED';
	const prerequisite = !provisional && blocked;
	return html`
		<header class="page-header">
			<h1 tabindex="-1" data-provisional-entry=${getWorkflowEntryId() ?? ''}>
				${text.title}
			</h1>
		</header>
		<section class="page-body" data-testid="provisional-route">
			${loading
				? html`<p role="status">${text.loading}</p>`
				: html`<p class="notification notification-alert" role="status">
							${prerequisite
								? datasetMissing
									? text.datasetRequired
									: text.targetRequired
								: retry
									? text.pending
									: text.unavailable}
						</p>
						${retry
							? html`<button
									type="button"
									class="btn"
									@click=${retryProvisionalRoute}>
									${text.retry}
								</button>`
							: nothing}
						${prerequisite
							? html`<a href=${datasetMissing ? '/data' : '/target'}
									>${datasetMissing ? text.dataset : text.target}</a
								>`
							: html`<a href="/models">${text.models}</a>`}`}
		</section>
	`;
}

function focusReservedPointerInvoker(event: MouseEvent): void {
	if (
		event.defaultPrevented ||
		!event.isTrusted ||
		event.detail === 0 ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		$route.get().kind !== 'workflow'
	) {
		return;
	}

	const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
	const href = anchor?.getAttribute('href');
	if (
		!anchor ||
		!href ||
		href.startsWith('#') ||
		(anchor.target && anchor.target !== '_self') ||
		anchor.hasAttribute('download') ||
		anchor.origin !== window.location.origin ||
		parseRoute(anchor.pathname).kind !== 'reserved'
	) {
		return;
	}

	// Set the native dialog's focus origin before the document router opens it.
	anchor.focus({ preventScroll: true });
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
	const activeWorkflowRoute = getEffectiveWorkflowRoute(currentRoute);
	const active = document.activeElement;
	const transferProvisionalFocus =
		currentRoute.kind === 'workflow' &&
		currentRoute.path === '/models/new' &&
		currentRoute.provisional?.kind === 'bound' &&
		active?.getAttribute('data-provisional-entry') === getWorkflowEntryId();
	const messages = storageMessages.get();
	const release = releaseMessages.get();

	const template = html`
		<app-sidebar></app-sidebar>
		<main id="content">
			${$staleAssetDetected.get()
				? html`<div class="notification notification-alert" role="alert">
						<span class="notification-text">${release.message}</span>
						<button type="button" class="btn" @click=${() => window.location.reload()}>
							${release.reload}
						</button>
					</div>`
				: nothing}
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
	if ((requestedFocus || transferProvisionalFocus) && currentRoute.kind === 'workflow') {
		const controller = new AbortController();
		pendingHeadingFocus = controller;
		const view = container.querySelector<WorkflowFocusView>(
			'#content > app-data-view, #content > app-target-view, #content > app-models-view, #content > app-model-builder-view, #content > app-results-view'
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
		if (currentRoute.path === '/models/new' && getEffectiveModelNum(currentRoute) === undefined)
			lastRestoredScrollKey = null;
		if (scrollKey && scrollKey !== lastRestoredScrollKey) {
			lastRestoredScrollKey = scrollKey;
			const viewEl = container.querySelector<
				HTMLElementTagNameMap[
					| 'app-data-view'
					| 'app-model-builder-view'
					| 'app-results-view']
			>(
				'#content > app-data-view, #content > app-model-builder-view, #content > app-results-view'
			);
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

	// 4b. Initialize beta telemetry and global error hooks
	initBetaTelemetry(() => $appState.get().onboarding.betaTelemetryAccepted);
	window.addEventListener('error', () => {
		reportBetaException('window-error');
	});
	window.addEventListener('unhandledrejection', () => {
		reportBetaException('unhandled-rejection');
	});
	onWorkerFailure((code) => {
		reportBetaException(code);
	});
	$route.subscribe((route) => {
		syncBetaRoute(route);
	});

	// 5. Mount root shell
	const root = document.getElementById('app');
	if (root) {
		root.addEventListener('click', focusReservedPointerInvoker);
		renderAppShell(root);
		// Subscribe to route changes to re-render views dynamically
		$route.subscribe(() => {
			renderAppShell(root);
		});
		$storageSaveNotice.listen(() => renderAppShell(root));
		$publicationPending.listen(() => renderAppShell(root));
		$appState.listen((state, previous) => {
			const route = getEffectiveWorkflowRoute($route.get());
			if (route.kind !== 'workflow' || route.path !== '/models/new' || !previous) return;
			const binding = route.provisional?.kind === 'bound' && route.provisional.identity;
			if (
				state.dataset?.id !== previous.dataset?.id ||
				state.target !== previous.target ||
				state.comparisonContextEpoch !== previous.comparisonContextEpoch ||
				(binding &&
					Boolean(provisionalRouteModel(binding, state)) !==
						Boolean(provisionalRouteModel(binding, previous)))
			)
				renderAppShell(root);
		});
		$staleAssetDetected.listen(() => renderAppShell(root));
		installStaleReleaseDetection();
		getTrainingService().observePublishedStops();
		storageMessages.listen(() => renderAppShell(root));
		releaseMessages.listen(() => renderAppShell(root));
		provisionalMessages.listen(() => renderAppShell(root));
		window.addEventListener('storage', (event) => {
			if (event.key !== STATE_STORAGE_KEY && event.key !== null) return;
			void refreshTrainingSnapshot().then((ack) => {
				if (!ack.ok) {
					startupRecovery = true;
					renderAppShell(root);
					return;
				}
				adoptStoredBetaAcceptance();
				initBetaTelemetry(() => $appState.get().onboarding.betaTelemetryAccepted);
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
