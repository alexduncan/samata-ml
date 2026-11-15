import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import { ContentLoadError, loadContentEntry } from '../../common/content/content-loader';
import {
	$appState,
	chooseModel,
	completeSection,
	initialiseFeatureSelection,
	reopenSection,
	setFeatures,
	toggleFeature
} from '../../stores/app.store';
import { $datasetResources, loadDatasetResources } from '../../stores/dataset.store';
import { blockedReason } from '../../stores/predicates';
import { buttonStyles } from '../../styles/button.styles';
import { cardStyles } from '../../styles/card.styles';
import { chicletStyles } from '../../styles/chiclet.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { tableStyles } from '../../styles/table.styles';
import { trainModelStyles } from '../../styles/train-model.styles';
import type { ColumnType, ModelRecord, ModelSectionId } from '../../types/state';
import { buildFeatureRows, formatFeatureNote, type FeatureRow } from './feature-eligibility';
import { modelsForTarget, SUPERVISED_MODELS, type ModelCatalogueEntry } from './model-catalogue';
import type { ModelDescriptionStatus } from './app-model-description-dialog';
import './app-model-description-dialog';
import '../../components/app-model-card';

/**
 * Connected root workflow view for Step 3: Model Builder (/models/:num).
 * Manages 6-step accordion sections, Choose Model (Logistic Regression card + text entries fallback),
 * and Select Features with confirmed reopening.
 * Follows specification/plans/step-3-train-models-overview-and-setup.md D1, D4, D5, D6, TODO-06, TODO-07.
 */
@customElement('app-model-builder-view')
export class AppModelBuilderView extends LitElement {
	static override readonly styles = [
		dialogStyles,
		buttonStyles,
		cardStyles,
		chicletStyles,
		tableStyles,
		notificationStyles,
		trainModelStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			.page-header {
				margin-block-end: 1.5rem;

				> h1 {
					margin: 0;
					color: var(--stone-900);
					font-weight: 500;
					font-size: 1.5rem;
				}

				> p {
					margin: 0.25rem 0 0;
					color: var(--stone-700);
					line-height: 1.5;
				}
			}

			a {
				color: var(--blue-700);
			}

			code {
				font-family: var(--font-mono);
			}

			/* Section Actions */
			.section-actions {
				display: flex;
				align-items: center;
				gap: 1rem;
				margin-block-start: 1.5rem;
			}

			.validation-hint {
				margin: 0;
				color: var(--stone-600);
				font-size: 0.875rem;
			}

			.completed-summary {
				padding: 0.5rem 0;
				color: var(--stone-800);
			}

			/* Models list in Section 1 */
			.cards-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
				gap: 1.5rem;
				margin-block-start: 1rem;
			}

			.text-model-entries {
				display: grid;
				gap: 1rem;
				margin-block-start: 1.5rem;
				padding: 0;
				list-style: none;

				> li {
					box-sizing: border-box;
					border: 1px solid var(--stone-300);
					border-radius: 0.5rem;
					background-color: var(--surface);
					padding: 1rem;

					&.selected {
						box-shadow: 0 0 0 1px var(--blue-500);
						border-color: var(--blue-500);
					}

					h3 {
						margin: 0 0 0.25rem 0;
						color: var(--stone-900);
						font-weight: 600;
						font-size: 1.125rem;
					}

					p {
						margin: 0 0 1rem 0;
						color: var(--stone-700);
						font-size: 0.875rem;
						line-height: 1.4;
					}

					.entry-actions {
						display: flex;
						flex-wrap: wrap;
						gap: 0.5rem;
					}
				}
			}

			/* Features selection in Section 2 */
			.features-table-container {
				margin-block-start: 1rem;
				inline-size: 100%;
				overflow-x: auto;
			}

			.table-checkbox-col {
				inline-size: 3rem;
				text-align: center;
			}

			.notes-list {
				margin: 0;
				padding-inline-start: 1.25rem;
			}

			.reopen-btn {
				padding: 0.25rem 0.5rem;
				font-size: 0.875rem;
			}

			.pending-notice {
				margin: 0;
				color: var(--stone-600);
				font-style: italic;
			}

			/* Reopen confirmation modal */
			dialog.confirm-dialog {
				box-shadow: var(--shadow-deep);
				border: 1.5px solid var(--stone-200);
				border-radius: 1rem;
				background-color: var(--surface);
				padding: 1.5rem;
				inline-size: min(32rem, calc(100% - 2rem));
				max-inline-size: none;
				max-block-size: calc(100dvh - 2rem);
				overflow: auto;
				color: var(--stone-800);
			}

			.confirm-header h2 {
				margin: 0;
				color: var(--stone-900);
				font-weight: 600;
				font-size: 1.25rem;
			}

			.confirm-body {
				margin-block: 1rem;
				color: var(--stone-700);
				line-height: 1.5;
			}

			.confirm-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.75rem;
			}
		`
	];

	private readonly appStateController = new StoreController(this, $appState);
	private readonly resourcesController = new StoreController(this, $datasetResources);

	/** Monotonically allocated sequential model number (e.g. 1 for /models/1). */
	@property({ type: Number, attribute: 'model-num' })
	accessor modelNum = 0;

	// Description dialog state
	@state() private accessor dialogOpen = false;
	@state() private accessor dialogHeading = '';
	@state() private accessor dialogContent: DocumentFragment | null = null;
	@state() private accessor dialogFallback = '';
	@state() private accessor dialogStatus: ModelDescriptionStatus = 'loading';
	@state() private accessor activeDescribeModelId: string | null = null;

	// Reopening state
	@state() private accessor pendingReopenSection: ModelSectionId | null = null;

	private loadPromise: Promise<void> | null = null;
	private contentAbortController = new AbortController();

	private get currentModel(): ModelRecord | undefined {
		return this.appStateController.value.models.find((m) => m.num === this.modelNum);
	}

	private get confirmDialogEl(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog.confirm-dialog') ?? null;
	}

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

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.contentAbortController.abort();
	}

	/**
	 * Waits for current metadata resources and render updates to settle.
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		if (this.loadPromise) {
			try {
				await this.loadPromise;
			} catch {
				// Errors captured in store
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

	// ==========================================
	// Description Dialog Handlers
	// ==========================================

	private async openModelDescription(modelId: string, name: string): Promise<void> {
		this.activeDescribeModelId = modelId;
		this.dialogHeading = name;
		this.dialogOpen = true;
		this.dialogStatus = 'loading';
		this.dialogContent = null;

		const entry = SUPERVISED_MODELS.find((e) => e.id === modelId);
		this.dialogFallback = entry?.description ?? '';

		this.contentAbortController.abort();
		this.contentAbortController = new AbortController();

		try {
			const result = await loadContentEntry('models', modelId, {
				signal: this.contentAbortController.signal
			});
			if (this.activeDescribeModelId === modelId) {
				this.dialogContent = result.content;
				this.dialogStatus = 'ready';
			}
		} catch (err) {
			if (this.contentAbortController.signal.aborted) return;
			if (this.activeDescribeModelId === modelId) {
				if (err instanceof ContentLoadError && err.code === 'NOT_FOUND') {
					this.dialogStatus = 'missing';
				} else {
					this.dialogStatus = 'error';
				}
			}
		}
	}

	private handleModelDescriptionOpen(e: CustomEvent<{ modelId: string; name: string }>): void {
		void this.openModelDescription(e.detail.modelId, e.detail.name);
	}

	private handleTextDescriptionClick(e: MouseEvent): void {
		const btn = e.currentTarget as HTMLElement;
		const modelId = btn.dataset.modelId;
		const name = btn.dataset.name;
		if (modelId && name) {
			void this.openModelDescription(modelId, name);
		}
	}

	private handleDescriptionClose(): void {
		this.dialogOpen = false;
	}

	private handleDescriptionRetry(): void {
		if (this.activeDescribeModelId && this.dialogHeading) {
			void this.openModelDescription(this.activeDescribeModelId, this.dialogHeading);
		}
	}

	// ==========================================
	// Section 1: Choose Model Handlers
	// ==========================================

	private handleModelSelect(e: CustomEvent<{ modelId: string; name: string }>): void {
		chooseModel(this.modelNum, e.detail.modelId);
	}

	private handleTextSelectClick(e: MouseEvent): void {
		const btn = e.currentTarget as HTMLElement;
		const modelId = btn.dataset.modelId;
		if (modelId) {
			chooseModel(this.modelNum, modelId);
		}
	}

	private handleContinueChooseModel(): void {
		const model = this.currentModel;
		if (!model || !model.modelId) return;

		// 1. Mark section 1 completed
		completeSection(this.modelNum, 'choose-model');

		// 2. Initialise feature selection ONCE only
		const resources = this.resourcesController.value;
		const appState = this.appStateController.value;
		if (resources.metadata && appState.target) {
			const featureRows = buildFeatureRows(
				resources.metadata,
				appState.target,
				resources.descriptor
			);
			const defaultFeatures = featureRows
				.filter((r) => r.initiallySelected)
				.map((r) => r.name);
			initialiseFeatureSelection(this.modelNum, defaultFeatures);
		}
	}

	// ==========================================
	// Section 2: Select Features Handlers
	// ==========================================

	private handleFeatureToggle(featureName: string): void {
		toggleFeature(this.modelNum, featureName);
	}

	private handleContinueSelectFeatures(): void {
		const model = this.currentModel;
		if (!model || model.features.length === 0) return;
		completeSection(this.modelNum, 'select-features');
	}

	// ==========================================
	// Reopening Flow
	// ==========================================

	private handleReopenClick(section: ModelSectionId): void {
		const model = this.currentModel;
		if (!model) return;

		// Check if later downstream sections are completed
		const completed = model.completedSteps;
		const hasDownstream =
			section === 'choose-model'
				? completed.includes('select-features') ||
					completed.includes('configure-model') ||
					completed.includes('configure-training')
				: completed.includes('configure-model') || completed.includes('configure-training');

		if (hasDownstream) {
			this.pendingReopenSection = section;
			if (this.confirmDialogEl) {
				try {
					this.confirmDialogEl.showModal();
				} catch {
					this.confirmDialogEl.open = true;
				}
			}
		} else {
			reopenSection(this.modelNum, section);
		}
	}

	private handleConfirmReopen(): void {
		if (this.pendingReopenSection) {
			reopenSection(this.modelNum, this.pendingReopenSection);
			this.pendingReopenSection = null;
		}
		if (this.confirmDialogEl?.open) {
			this.confirmDialogEl.close();
			this.confirmDialogEl.returnValue = '';
		}
	}

	private handleCancelReopen(): void {
		this.pendingReopenSection = null;
		if (this.confirmDialogEl?.open) {
			this.confirmDialogEl.close();
			this.confirmDialogEl.returnValue = '';
		}
	}

	// ==========================================
	// Render Sections
	// ==========================================

	private renderLogisticRegressionSvg(): TemplateResult {
		return html`
			<svg class="card-image" slot="image" viewBox="0 0 360 216" aria-hidden="true">
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(95 60)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(192 159)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(222 115)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(174 34)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(272 48)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(130 83)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(39 115)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(21 50)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(83 28)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(78 95)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(220 36)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(168 140)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(82 192)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(116 134)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(142 165)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(245 138)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(297 122)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(251 83)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(192 74)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(95 115)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(154 80)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(141 54)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(196 48)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(143 91)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(167 173)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(186 119)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--blue-200)"
					fill-rule="evenodd"
					transform="translate(208 101)" />
				<circle
					cx="6"
					cy="6"
					r="6"
					fill="var(--amber-300)"
					fill-rule="evenodd"
					transform="translate(142 126)" />
				<line
					x1="10"
					x2="350"
					y1="185"
					y2="10"
					stroke="var(--stone-700)"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="6" />
			</svg>
		`;
	}

	private renderChooseModelSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;

		// Determine target column type
		let targetType: ColumnType = 'categorical';
		if (appState.target && resources.metadata) {
			const targetCol = resources.metadata.columns.find((c) => c.name === appState.target);
			if (targetCol) {
				targetType = targetCol.type;
			}
		}

		const availableModels = modelsForTarget(targetType);

		let selectedModelName = '';
		if (model.modelId) {
			const entry = SUPERVISED_MODELS.find((e) => e.id === model.modelId);
			selectedModelName = entry ? entry.name : model.modelId;
		}

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} ${!isActive && !isCompleted
					? 'train-step-pending'
					: ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-1-title">
					<header class="train-step-header">
						<h2 id="step-1-title">1. Choose Model</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										<button
											type="button"
											class="btn reopen-btn"
											aria-label="Reopen Choose Model"
											@click=${() => this.handleReopenClick('choose-model')}>
											Edit
										</button>
										<span class="visually-hidden">Completed</span>
										<svg
											aria-hidden="true"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="currentColor">
											<path
												d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
										</svg>
									</span>
								`
							: nothing}
					</header>

					<div class="train-step-content" ?hidden=${!isActive && isCompleted}>
						${isCompleted && !isActive
							? html`
									<div class="completed-summary">
										<p>Selected model: <strong>${selectedModelName}</strong></p>
									</div>
								`
							: html`
									<p>
										Choose which machine learning model to train on your
										dataset.
									</p>

									<!-- 1. Illustrated entry for Logistic Regression (if available for target) -->
									${availableModels.some((m) => m.id === 'logistic-regression')
										? html`
												<div class="cards-grid">
													<app-model-card
														model-id="logistic-regression"
														type="classification"
														name="Logistic Regression"
														description="A classification tool used to predict a binary outcome by estimating the exact probability of an event happening. Highly reliable for clear-cut, two-option decisions."
														@app-model-description-open=${this
															.handleModelDescriptionOpen}
														@app-model-select=${this.handleModelSelect}>
														${this.renderLogisticRegressionSvg()}
													</app-model-card>
												</div>
											`
										: nothing}

									<!-- 2. Native text entries fallback for remaining models -->
									<ul
										class="text-model-entries"
										aria-label="Available models text entries">
										${availableModels
											.filter((m) => m.id !== 'logistic-regression')
											.map(
												(entry) => html`
													<li
														class="text-model-entry ${model.modelId ===
														entry.id
															? 'selected'
															: ''}">
														<h3>${entry.name}</h3>
														<p>${entry.description}</p>
														<div class="entry-actions">
															<button
																type="button"
																class="btn"
																aria-label="Model Description: ${entry.name}"
																data-model-id="${entry.id}"
																data-name="${entry.name}"
																@click=${this
																	.handleTextDescriptionClick}>
																Model Description
															</button>
															<button
																type="button"
																class="btn ${model.modelId ===
																entry.id
																	? 'btn-selected'
																	: 'btn-primary'}"
																aria-label="Select Model: ${entry.name}"
																data-model-id="${entry.id}"
																data-name="${entry.name}"
																@click=${this
																	.handleTextSelectClick}>
																${model.modelId === entry.id
																	? 'Selected'
																	: 'Select Model'}
															</button>
														</div>
													</li>
												`
											)}
									</ul>

									<div class="section-actions">
										<button
											type="button"
											class="btn btn-primary"
											?disabled=${!model.modelId}
											@click=${this.handleContinueChooseModel}>
											Continue
										</button>
										${!model.modelId
											? html`<p class="validation-hint">
													Select a model to continue.
												</p>`
											: nothing}
									</div>
								`}
					</div>
				</section>
			</li>
		`;
	}

	private renderSelectFeaturesSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;
		const metadata = resources.metadata;
		const dataset = appState.dataset;

		let featureRows: FeatureRow[] = [];
		if (metadata && appState.target) {
			featureRows = buildFeatureRows(metadata, appState.target, resources.descriptor);
		}

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} ${!isActive && !isCompleted
					? 'train-step-pending'
					: ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-2-title">
					<header class="train-step-header">
						<h2 id="step-2-title">2. Select Features</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										<button
											type="button"
											class="btn reopen-btn"
											aria-label="Reopen Select Features"
											@click=${() =>
												this.handleReopenClick('select-features')}>
											Edit
										</button>
										<span class="visually-hidden">Completed</span>
										<svg
											aria-hidden="true"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="currentColor">
											<path
												d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
										</svg>
									</span>
								`
							: nothing}
					</header>

					<div class="train-step-content" ?hidden=${!isActive && isCompleted}>
						${isCompleted && !isActive
							? html`
									<div class="completed-summary">
										<p>
											Selected features (${model.features.length}):
											<strong>${model.features.join(', ')}</strong>
										</p>
									</div>
								`
							: html`
									<form
										id="features-form"
										@submit=${(e: Event) => e.preventDefault()}>
										<fieldset style="border: 0; padding: 0; margin: 0;">
											<legend>Features to include in model training</legend>

											<div class="features-table-container">
												<table class="table">
													<caption>
														Features for ${dataset?.name ?? 'dataset'}
													</caption>
													<thead>
														<tr>
															<th
																scope="col"
																class="table-checkbox-col">
																Include
															</th>
															<th scope="col">Feature Name</th>
															<th scope="col">Type</th>
															<th scope="col">Notes</th>
														</tr>
													</thead>
													<tbody>
														${featureRows.map((row) => {
															const formattedType =
																row.type.charAt(0).toUpperCase() +
																row.type.slice(1);
															const isChecked =
																model.features.includes(row.name);

															const inputId = `feature-${row.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

															return html`
																<tr>
																	<td class="table-checkbox-col">
																		${row.isTarget
																			? html`<span
																					class="badge chiclet chiclet-teal"
																					>Target</span
																				>`
																			: html`
																					<input
																						type="checkbox"
																						id="${inputId}"
																						?disabled=${!row.eligible}
																						.checked=${isChecked}
																						aria-label="Include ${row.name}"
																						@change=${() =>
																							this.handleFeatureToggle(
																								row.name
																							)} />
																				`}
																	</td>
																	<th scope="row">
																		<label for="${inputId}">
																			${row.name}
																		</label>
																	</th>
																	<td>
																		<code
																			>${formattedType}</code
																		>
																	</td>
																	<td>
																		${row.reasonCodes.length > 0
																			? html`
																					<ul
																						class="notes-list">
																						${row.reasonCodes.map(
																							(
																								code
																							) =>
																								html`<li>
																									${formatFeatureNote(
																										code
																									)}
																								</li>`
																						)}
																					</ul>
																				`
																			: nothing}
																	</td>
																</tr>
															`;
														})}
													</tbody>
												</table>
											</div>

											<div class="section-actions">
												<button
													type="button"
													class="btn btn-primary"
													?disabled=${model.features.length === 0}
													@click=${this.handleContinueSelectFeatures}>
													Continue
												</button>
												${model.features.length === 0
													? html`<p class="validation-hint">
															Select at least one feature to continue.
														</p>`
													: nothing}
											</div>
										</fieldset>
									</form>
								`}
					</div>
				</section>
			</li>
		`;
	}

	private renderPendingSection(
		title: string,
		stepId: string,
		stepKey: ModelSectionId,
		activeStep: number,
		stepIndex: number
	): TemplateResult {
		const isActive = activeStep === stepIndex;

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} train-step-pending"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="${stepId}">
					<header class="train-step-header">
						<h2 id="${stepId}">${title}</h2>
					</header>
					<div class="train-step-content" ?hidden=${!isActive}>
						<p class="pending-notice">Not available yet.</p>
					</div>
				</section>
			</li>
		`;
	}

	override render(): TemplateResult {
		const appState = this.appStateController.value;
		const model = this.currentModel;

		if (!model) {
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Model Not Found</h1>
					<p class="description">The requested model could not be found.</p>
				</div>
				<section class="page-body" data-testid="model-not-found">
					<div class="notification notification-alert">
						<p class="notification-text">
							Model ${this.modelNum} does not exist.
							<a href="/models">Back to Models</a>
						</p>
					</div>
				</section>
			`;
		}

		// Calculate active step
		let activeStep = 1;
		if (!model.completedSteps.includes('choose-model')) {
			activeStep = 1;
		} else if (!model.completedSteps.includes('select-features')) {
			activeStep = 2;
		} else if (!model.completedSteps.includes('configure-model')) {
			activeStep = 3;
		} else if (!model.completedSteps.includes('configure-training')) {
			activeStep = 4;
		} else if (!model.completedSteps.includes('training')) {
			activeStep = 5;
		} else {
			activeStep = 6;
		}

		const isStep1Completed = model.completedSteps.includes('choose-model');
		const isStep2Completed = model.completedSteps.includes('select-features');

		return html`
			<div class="page-header">
				<h1 tabindex="-1">Model ${model.num}</h1>
				<p class="description">
					Configure architecture and features for Model ${model.num}.
				</p>
			</div>

			<section class="page-body" data-testid="model-builder">
				<ol class="train-model" aria-label="Model training steps">
					${this.renderChooseModelSection(model, activeStep === 1, isStep1Completed)}
					${this.renderSelectFeaturesSection(model, activeStep === 2, isStep2Completed)}
					${this.renderPendingSection(
						'3. Configure Model',
						'step-3-title',
						'configure-model',
						activeStep,
						3
					)}
					${this.renderPendingSection(
						'4. Training Setup',
						'step-4-title',
						'configure-training',
						activeStep,
						4
					)}
					${this.renderPendingSection(
						'5. Train Model',
						'step-5-title',
						'training',
						activeStep,
						5
					)}
					${this.renderPendingSection(
						'6. Model Results',
						'step-6-title',
						'results',
						activeStep,
						6
					)}
				</ol>
			</section>

			<!-- Embedded Description Dialog -->
			<app-model-description-dialog
				?open=${this.dialogOpen}
				.heading=${this.dialogHeading}
				.content=${this.dialogContent}
				.fallback=${this.dialogFallback}
				.status=${this.dialogStatus}
				.labels=${{
					close: 'Close',
					retry: 'Retry',
					status: 'Loading model description…'
				}}
				@app-model-description-close=${this.handleDescriptionClose}
				@app-model-description-retry=${this.handleDescriptionRetry}>
			</app-model-description-dialog>

			<!-- Reopen Confirmation Dialog -->
			<dialog class="confirm-dialog" aria-labelledby="confirm-reopen-title">
				<div class="confirm-header">
					<h2 id="confirm-reopen-title">Confirm Reopening Section</h2>
				</div>
				<div class="confirm-body">
					<p class="notification notification-alert">
						Reopening this section will clear downstream completed steps. Your
						selections will be kept.
					</p>
					<p>Are you sure you want to edit this section?</p>
				</div>
				<div class="confirm-footer">
					<button type="button" class="btn" @click=${this.handleCancelReopen}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary"
						@click=${this.handleConfirmReopen}>
						Edit Section
					</button>
				</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-builder-view': AppModelBuilderView;
	}
}
