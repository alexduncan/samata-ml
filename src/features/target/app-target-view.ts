import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import { $appState } from '../../stores/app.store';
import { $datasetResources, loadDatasetResources } from '../../stores/dataset.store';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { tableStyles } from '../../styles/table.styles';
import type { ColumnStats, DatasetMetadata } from '../../types/dataset';
import { i18n } from '../../i18n';
import {
	getTrainingService,
	type TrainingCommandFailure
} from '../models/training/training-service';
import {
	buildTargetRows,
	formatTargetNote,
	type TargetColumnRow,
	type TargetNoteCode
} from './target-eligibility';

const targetChangeMessages = i18n('app-target-change', {
	remote: 'Training in another tab',
	busy: 'The dataset is busy. Try again.',
	failed: 'The target could not be changed. Try again.',
	pending: 'The change is saved, but finishing is pending. Retry saving.',
	retry: 'Retry saving',
	changed: 'Change Target',
	changing: 'Changing…'
});

/**
 * Connected root workflow view for Step 2: Set Target.
 * Follows specification/plans/step-2-set-target.md.
 */
@customElement('app-target-view')
export class AppTargetView extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		dialogStyles,
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
				margin-block-end: 1.5rem;
				inset-block-start: 0;

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

				> a.btn,
				> button {
					grid-area: action;
					justify-self: end;
				}
			}

			a {
				color: var(--blue-700);
			}

			code {
				font-family: var(--font-mono);
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

			.notes-list {
				margin: 0;
				padding-inline-start: 1.25rem;
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

	private readonly appStateController = new StoreController(this, $appState);
	private readonly resourcesController = new StoreController(this, $datasetResources);

	@state() private accessor pendingTarget: string | null = null;
	@state() private accessor dialogDatasetId: string | null = null;
	@state() private accessor targetChanging = false;
	@state() private accessor targetPublicationPending = false;
	@state() private accessor targetChangeError: string | null = null;
	private originalTarget: string | null = null;
	private readonly targetMessages = new StoreController(this, targetChangeMessages);

	private loadPromise: Promise<void> | null = null;
	private get confirmDialogEl(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector('dialog.confirm-dialog') ?? null;
	}
	private dialogInvoker: HTMLElement | null = null;

	override willUpdate(_changed: PropertyValues<this>): void {
		const appState = this.appStateController.value;
		const datasetId = appState.dataset?.id ?? null;

		// Cancel modal safely if dataset changed while open
		if (this.dialogDatasetId !== null && datasetId !== this.dialogDatasetId) {
			if (this.confirmDialogEl && this.confirmDialogEl.open) {
				this.confirmDialogEl.close();
				this.confirmDialogEl.returnValue = '';
			}
			this.pendingTarget = null;
			this.dialogDatasetId = null;
		}

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

	private handleRetry = (): void => {
		const appState = this.appStateController.value;
		if (appState.dataset) {
			this.loadPromise = loadDatasetResources(appState.dataset.id);
		}
	};

	private handleSetTargetClick = (e: MouseEvent): void => {
		const target = e.currentTarget as HTMLElement | null;
		const column = target?.dataset.column;
		if (!column) return;
		this.requestSetTarget(column, target);
	};

	private requestSetTarget(column: string, invoker: HTMLElement | null): void {
		const appState = this.appStateController.value;
		if (!appState.dataset || this.targetChanging || this.targetPublicationPending) return;
		this.targetChangeError = null;

		// No-op for current target
		if (appState.target === column) {
			return;
		}

		// Warning & confirmation dialog when any model exists
		if (appState.models.length > 0) {
			this.pendingTarget = column;
			this.dialogDatasetId = appState.dataset.id;
			this.originalTarget = appState.target;
			this.dialogInvoker = invoker;
			if (this.confirmDialogEl && !this.confirmDialogEl.open) {
				this.confirmDialogEl.showModal();
			}
			return;
		}

		// No models exist: set target directly
		this.targetChanging = true;
		void getTrainingService()
			.chooseTarget(column)
			.then((result) => {
				if (!result.ok) this.showTargetFailure(result);
			})
			.finally(() => {
				this.targetChanging = false;
			});
	}

	private showTargetFailure(result: TrainingCommandFailure): void {
		const labels = this.targetMessages.value;
		this.targetPublicationPending ||= result.pending === 'discard';
		this.targetChangeError = this.targetPublicationPending
			? labels.pending
			: result.code === 'remote-training'
				? labels.remote
				: result.code === 'busy'
					? labels.busy
					: labels.failed;
	}

	private handleCancelConfirm = (): void => {
		if (this.targetChanging || this.targetPublicationPending) return;
		if (this.confirmDialogEl && this.confirmDialogEl.open) {
			this.confirmDialogEl.close();
			this.confirmDialogEl.returnValue = '';
		}
		this.pendingTarget = null;
		this.dialogDatasetId = null;
		this.targetChangeError = null;
		if (this.dialogInvoker && typeof this.dialogInvoker.focus === 'function') {
			this.dialogInvoker.focus();
		}
		this.dialogInvoker = null;
	};

	private handleDialogClose = (): void => {
		if (this.confirmDialogEl) {
			this.confirmDialogEl.returnValue = '';
		}
		this.pendingTarget = null;
		this.dialogDatasetId = null;
		if (this.dialogInvoker && typeof this.dialogInvoker.focus === 'function') {
			this.dialogInvoker.focus();
		}
		this.dialogInvoker = null;
	};

	private handleConfirmTargetChange = async (): Promise<void> => {
		const targetColumn = this.pendingTarget;
		const initialDatasetId = this.dialogDatasetId;
		if (this.targetChanging || !targetColumn || !initialDatasetId) return;
		this.targetChanging = true;
		this.targetChangeError = null;
		const result = this.targetPublicationPending
			? await getTrainingService().retry()
			: await getTrainingService().discardTarget(
					initialDatasetId,
					this.originalTarget,
					targetColumn
				);
		this.targetChanging = false;
		if (result.ok) {
			this.targetPublicationPending = false;
			this.handleCancelConfirm();
		} else this.showTargetFailure(result);
	};

	private handleDialogCancel(event: Event): void {
		if (this.targetChanging || this.targetPublicationPending) event.preventDefault();
	}

	private async retryTargetPublication(): Promise<void> {
		if (this.targetChanging) return;
		this.targetChanging = true;
		const result = await getTrainingService().retry();
		this.targetChanging = false;
		if (result.ok) {
			this.targetPublicationPending = false;
			this.targetChangeError = null;
		} else this.showTargetFailure(result);
	}

	private renderHeader(showContinue: boolean): TemplateResult {
		return html`
			<header class="page-header">
				<h1 tabindex="-1">Set Target</h1>
				<p>
					Choose the column from your dataset that you want to train models to predict.
					<a href="/help">learn more...</a>
				</p>
				${showContinue
					? html`<a href="/models" class="btn btn-primary" data-testid="continue-models">
							Train Models
						</a>`
					: nothing}
			</header>
		`;
	}

	private renderBlockedState(): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="target-blocked">
				<p class="notification notification-alert">
					Load a dataset before choosing a target. <a href="/data">Load Data</a>
				</p>
			</section>
		`;
	}

	private renderLoadingState(): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="target-loading">
				<p role="status" class="status-message">Loading column information…</p>
			</section>
		`;
	}

	private renderErrorState(): TemplateResult {
		return html`
			${this.renderHeader(false)}
			<section class="page-body" data-testid="target-error">
				<p role="alert" class="error-message">Column information could not be loaded.</p>
				<button type="button" class="btn" @click=${this.handleRetry}>Retry</button>
			</section>
		`;
	}

	private getNoteParams(
		code: TargetNoteCode,
		stats?: ColumnStats
	): { count?: number } | undefined {
		if (code === 'ADVISORY_MISSING_VALUES' && stats) {
			return { count: stats.missingCount + stats.invalidCount };
		}
		if (code === 'ADVISORY_HIGH_CARDINALITY' && stats && stats.type === 'categorical') {
			return { count: stats.distinctCount };
		}
		return undefined;
	}

	private renderNotes(
		row: TargetColumnRow,
		stats?: ColumnStats
	): TemplateResult | typeof nothing {
		if (row.reasonCodes.length === 0) {
			return nothing;
		}

		if (row.reasonCodes.length === 1) {
			const code = row.reasonCodes[0]!;
			const params = this.getNoteParams(code, stats);
			return html`<span>${formatTargetNote(code, params)}</span>`;
		}

		return html`
			<ul class="notes-list">
				${row.reasonCodes.map((code) => {
					const params = this.getNoteParams(code, stats);
					return html`<li>${formatTargetNote(code, params)}</li>`;
				})}
			</ul>
		`;
	}

	private renderTableRow(row: TargetColumnRow, metadata: DatasetMetadata): TemplateResult {
		const formattedType = row.type.charAt(0).toUpperCase() + row.type.slice(1);
		const stats = metadata.columns.find((c) => c.name === row.name);

		return html`
			<tr>
				<th scope="row">${row.name}</th>
				<td><code>${formattedType}</code></td>
				<td>${this.renderNotes(row, stats)}</td>
				<td>
					${row.isCurrentTarget
						? html`<button type="button" class="btn" disabled>Current Target</button>`
						: html`<button
								type="button"
								class="btn ${row.eligible ? 'btn-primary' : ''}"
								?disabled=${!row.eligible}
								aria-label="Set as Target: ${row.name}"
								data-column=${row.name}
								@click=${this.handleSetTargetClick}>
								Set as Target
							</button>`}
				</td>
			</tr>
		`;
	}

	private renderReadyState(): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;
		const dataset = appState.dataset!;
		const metadata = resources.metadata!;
		const rows = buildTargetRows(dataset, appState.target, metadata, resources.descriptor);

		return html`
			${this.renderHeader(appState.target !== null)}
			${appState.models.length > 0
				? html`
						<div class="notification notification-alert" role="alert">
							<p class="notification-text">
								Changing the target will reset all existing models.
							</p>
						</div>
					`
				: nothing}
			<section class="page-body" data-testid="target-ready">
				<div class="table-scroll-container">
					<table class="table">
						<caption>
							${dataset.name} target candidates
						</caption>
						<thead>
							<tr>
								<th scope="col">Column Name</th>
								<th scope="col">Type</th>
								<th scope="col">Notes</th>
								<th scope="col">Action</th>
							</tr>
						</thead>
						<tbody>
							${rows.map((row) => this.renderTableRow(row, metadata))}
						</tbody>
					</table>
				</div>
			</section>
		`;
	}

	override render(): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;

		if (!appState.dataset) {
			return this.renderBlockedState();
		}

		if (resources.datasetId !== appState.dataset.id || resources.status === 'loading') {
			return this.renderLoadingState();
		}

		if (resources.status === 'error' || !resources.metadata) {
			return this.renderErrorState();
		}

		return html`
			${this.renderReadyState()}
			${this.targetChangeError && !this.pendingTarget
				? html`<p class="notification notification-alert" role="alert">
							${this.targetChangeError}
						</p>
						${this.targetPublicationPending
							? html`<button
									type="button"
									class="btn"
									?disabled=${this.targetChanging}
									@click=${this.retryTargetPublication}>
									${this.targetMessages.value.retry}
								</button>`
							: nothing}`
				: nothing}
			<dialog
				class="confirm-dialog"
				aria-labelledby="confirm-target-title"
				closedby=${this.targetChanging || this.targetPublicationPending
					? 'none'
					: 'closerequest'}
				@cancel=${this.handleDialogCancel}
				@close=${this.handleDialogClose}>
				<div class="confirm-header">
					<h2 id="confirm-target-title">Change Target</h2>
				</div>
				<div class="confirm-body">
					<p>Changing the target will reset all existing models.</p>
					<p>
						Confirmation: discard all models and set ${this.pendingTarget ?? ''} as the
						target?
					</p>
					${this.targetChangeError
						? html`<p role="alert">${this.targetChangeError}</p>`
						: nothing}
				</div>
				<div class="confirm-footer">
					<button
						type="button"
						class="btn"
						autofocus
						?disabled=${this.targetChanging || this.targetPublicationPending}
						@click=${this.handleCancelConfirm}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary"
						?disabled=${this.targetChanging}
						@click=${this.handleConfirmTargetChange}>
						${this.targetPublicationPending
							? this.targetMessages.value.retry
							: this.targetChanging
								? this.targetMessages.value.changing
								: this.targetMessages.value.changed}
					</button>
				</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-target-view': AppTargetView;
	}
}
