import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import { params } from '@nanostores/i18n';
import { i18n } from '../../i18n';
import { $appState } from '../../stores/app.store';
import { $datasetResources, loadDatasetResources } from '../../stores/dataset.store';
import { $canCompare, blockedReason } from '../../stores/predicates';
import { buttonStyles } from '../../styles/button.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { tableStyles } from '../../styles/table.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import { provisionalModelIn, type ModelRecord } from '../../types/state';
import { savedModelName } from './model-catalogue';
import { formatTrainingSetupSummary } from './training-setup';
import { StickyHeaderController } from '../shell/sticky-header-controller';

const messages = i18n('app-models-view', {
	oneShotSummary: 'One-Shot (80% / 20%)',
	crossValidationSummary: params<{ folds: number }>('Cross-Validation ({folds} folds)'),
	notConfigured: 'Not configured',
	create: 'Train New Model'
});

/**
 * Connected root workflow view for Step 3: Train Models Overview.
 * Displays monotonically numbered models, configuration summaries, and Train New Model action.
 * Follows specification/plans/step-3-train-models-overview-and-setup.md D1, D5 and TODO-08.
 */
@customElement('app-models-view')
export class AppModelsView extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		buttonStyles,
		tableStyles,
		notificationStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			.page-body {
				margin: 0 2rem 2rem;
			}

			.page-header {
				display: grid;
				position: sticky;
				grid-template-columns: minmax(0, 1fr) auto;
				grid-template-areas:
					'title       action'
					'description action';
				column-gap: 2rem;
				row-gap: 0.5rem;
				align-items: center;
				z-index: 10;
				box-sizing: border-box;
				inset-block-start: 0;
				background-color: var(--stone-50);
				padding: 1.5rem 2rem;
				inline-size: 100%;

				@media (max-height: 30rem) {
					position: static;
				}

				> h1 {
					grid-area: title;
					margin: 0;
					color: var(--stone-900);
					font-weight: 500;
					font-size: 1.5rem;
				}

				> p {
					grid-area: description;
					margin: 0;
					color: var(--stone-700);
					line-height: 1.75rem;
				}

				.header-actions {
					display: flex;
					grid-area: action;
					align-items: center;
					justify-self: end;
					gap: 0.75rem;
				}
			}

			a {
				color: var(--blue-700);
			}

			.table-scroll-container {
				inline-size: 100%;
				overflow-x: auto;
			}

			caption {
				padding-block-end: 0.5rem;
				color: var(--stone-800);
				font-weight: 600;
				text-align: start;
			}

			.compare-hint {
				margin-block-start: 1rem;
				color: var(--stone-600);
				font-size: 0.875rem;
			}

			.empty-message {
				padding-block: 1rem;
				color: var(--stone-700);
			}

			.status-message {
				padding-block: 1rem;
				color: var(--stone-700);
			}

			.error-message {
				padding-block: 1rem;
				color: var(--red-700);
			}
		`
	];

	private readonly stickyHeader = new StickyHeaderController(this);
	private readonly appStateController = new StoreController(this, $appState);
	private readonly resourcesController = new StoreController(this, $datasetResources);
	private readonly translations = new StoreController(this, messages);
	private readonly canCompareController = new StoreController(this, $canCompare);
	private readonly messagesController = new StoreController(this, messages);

	private loadPromise: Promise<void> | null = null;

	override willUpdate(_changed: PropertyValues<this>): void {
		const appState = this.appStateController.value;
		const datasetId = appState.dataset?.id ?? null;

		if (datasetId) {
			const resources = this.resourcesController.value;
			if (resources.datasetId !== datasetId || resources.status === 'idle') {
				this.loadPromise = loadDatasetResources(datasetId);
			}
		}
	}

	/**
	 * Focuses this route's heading after rendering, unless cancelled or disconnected.
	 *
	 * @param signal - Cancels a superseded navigation's focus request.
	 */
	async focusHeading(signal: AbortSignal): Promise<void> {
		if (signal.aborted || !this.isConnected) return;
		await this.updateComplete;
		if (signal.aborted || !this.isConnected) return;
		this.renderRoot.querySelector<HTMLElement>('.page-header > h1')?.focus({
			preventScroll: true
		});
	}

	/**
	 * Waits for current metadata resource operations and render updates to settle.
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		if (this.loadPromise) {
			try {
				await this.loadPromise;
			} catch {
				// Errors captured in resources store
			}
		} else if (this.resourcesController.value.status === 'loading') {
			await new Promise<void>((resolve) => {
				const unbind = $datasetResources.subscribe((res) => {
					if (res.status !== 'loading') {
						unbind();
						resolve();
					}
				});
			});
		}
		await this.updateComplete;
	}

	private handleRetry(): void {
		const appState = this.appStateController.value;
		if (appState.dataset?.id) {
			this.loadPromise = loadDatasetResources(appState.dataset.id);
		}
	}

	private renderHeader(canTrain: boolean): TemplateResult {
		const canCompare = this.canCompareController.value;
		const t = this.messagesController.value;

		return html`
			<div class="page-header">
				<h1 tabindex="-1">Train Models</h1>
				<p class="description">Train and compare models for the selected target.</p>
				<div class="header-actions">
					${canTrain
						? html`<a href="/models/new" class="btn btn-primary">${t.create}</a>`
						: html`<button type="button" class="btn btn-primary" disabled>
								${t.create}
							</button>`}
					${canCompare
						? html`<a href="/results" class="btn">Compare Results</a>`
						: html`<button
								type="button"
								class="btn"
								disabled
								title="Train at least two models to compare results.">
								Compare Results
							</button>`}
				</div>
			</div>
		`;
	}

	private renderBlockedState(reason: 'DATASET_REQUIRED' | 'TARGET_REQUIRED'): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="models-blocked">
				<div class="notification notification-alert">
					<p class="notification-text">
						${reason === 'DATASET_REQUIRED'
							? html`Load a dataset and choose a target before training a model.
									<a href="/data">Load Data</a>`
							: html`Choose a target before training a model.
									<a href="/target">Set Target</a>`}
					</p>
				</div>
			</section>
		`;
	}

	private renderLoadingState(): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="models-loading">
				<p role="status" class="status-message">Loading model information…</p>
			</section>
		`;
	}

	private renderErrorState(): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="models-error">
				<p role="alert" class="error-message">Model information could not be loaded.</p>
				<button type="button" class="btn" @click=${this.handleRetry}>Retry</button>
			</section>
		`;
	}

	private formatDuration(durationMs: number | null): string {
		if (durationMs === null) {
			return 'Not trained';
		}
		const seconds = (durationMs / 1000).toFixed(1);
		return `${seconds}s`;
	}

	private renderModelRow(model: ModelRecord): TemplateResult {
		const resources = this.resourcesController.value;

		// Model Name: Model {num} — {library name} or Model {num}
		let modelDisplayName = `Model ${model.num}`;
		if (model.modelId) {
			const libraryName = savedModelName(model) ?? model.modelId;
			modelDisplayName = `Model ${model.num} — ${libraryName}`;
		}

		// Features: in dataset order or 'Not selected'
		let featuresText = 'Not selected';
		if (model.features && model.features.length > 0) {
			if (resources.metadata) {
				const colOrder = resources.metadata.columns.map((c) => c.name);
				const sorted = [...model.features].sort(
					(a, b) => colOrder.indexOf(a) - colOrder.indexOf(b)
				);
				featuresText = sorted.join(', ');
			} else {
				featuresText = model.features.join(', ');
			}
		}

		// Configuration: 'Not configured' or plain persisted value
		const isConfigured = model.completedSteps.includes('configure-model');
		const configText = isConfigured ? model.hyperparameters.mode : 'Not configured';

		const labels = this.translations.value;
		const isTrainingSetup = model.completedSteps.includes('configure-training');
		const setupText =
			isTrainingSetup && model.trainingSetup
				? formatTrainingSetupSummary(model.trainingSetup, {
						oneShot: labels.oneShotSummary,
						crossValidation: (folds) => labels.crossValidationSummary({ folds })
					})
				: labels.notConfigured;

		// Duration
		const durationText = this.formatDuration(model.durationMs);

		// Action
		const actionLabel = model.status === 'trained' ? 'View Results' : 'Continue';
		const app = this.appStateController.value;
		const provisional = provisionalModelIn(app.models, app.newModelNum) === model;
		const href = provisional ? '/models/new' : `/models/${model.num}`;

		return html`
			<tr>
				<th scope="row">${modelDisplayName}</th>
				<td>${featuresText}</td>
				<td>${configText}</td>
				<td>${setupText}</td>
				<td>${durationText}</td>
				<td>
					<a
						href=${href}
						class="table-link"
						data-provisional-num=${provisional ? model.num : nothing}
						data-provisional-created-at=${provisional ? model.createdAt : nothing}
						>${actionLabel}</a
					>
				</td>
			</tr>
		`;
	}

	private renderReadyState(): TemplateResult {
		const appState = this.appStateController.value;
		const canCompare = this.canCompareController.value;
		const dataset = appState.dataset!;

		if (appState.models.length === 0) {
			return html`
				${this.renderHeader(true)}
				<section class="page-body" data-testid="models-empty">
					<p class="empty-message">No models yet. Train a new model to get started.</p>
				</section>
			`;
		}

		return html`
			${this.renderHeader(true)}
			<section class="page-body" data-testid="models-list">
				<div class="table-scroll-container">
					<table class="table">
						<caption>
							Models for ${dataset.name}
						</caption>
						<thead>
							<tr>
								<th scope="col">Model Name</th>
								<th scope="col">Features</th>
								<th scope="col">Configuration</th>
								<th scope="col">Training Setup</th>
								<th scope="col">Duration</th>
								<th scope="col">Action</th>
							</tr>
						</thead>
						<tbody>
							${appState.models.map((m) => this.renderModelRow(m))}
						</tbody>
					</table>
				</div>
				${!canCompare
					? html`<p class="compare-hint">
							Train at least two models to compare results.
						</p>`
					: nothing}
			</section>
		`;
	}

	override render(): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;

		const blocked = blockedReason('/models', appState);
		if (blocked === 'DATASET_REQUIRED' || blocked === 'TARGET_REQUIRED') {
			return this.renderBlockedState(blocked);
		}

		if (
			appState.dataset &&
			(resources.datasetId !== appState.dataset.id || resources.status === 'loading')
		) {
			return this.renderLoadingState();
		}

		if (resources.status === 'error' || !resources.metadata) {
			return this.renderErrorState();
		}

		return this.renderReadyState();
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-models-view': AppModelsView;
	}
}
