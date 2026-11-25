import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import { observeDialogHeader } from '../../common/dom/dialog-header';
import { dialogStyles } from '../../styles/dialog.styles';
import type { IngestionProgress } from './ingestion/pipeline';
import { INGESTION_PHASE_LABELS } from './ingestion/errors';

/**
 * Labels accepted by the upload dataset dialog.
 */
export interface UploadDialogLabels {
	heading: string;
	file: string;
	requirements: string;
	phase: string;
	cancel: string;
	close: string;
}

/**
 * Presentational modal dialog for custom dataset file upload.
 * Follows specification/plans/step-1-load-data-and-preview.md T3.
 */
@customElement('app-upload-dataset-dialog')
export class AppUploadDatasetDialog extends LitElement {
	static override readonly styles = [
		dialogStyles,
		buttonStyles,
		css`
			.dropzone {
				cursor: pointer;
				border: 2px dashed;
				border-color: var(--blue-700);
				border-radius: 1rem;
				background-color: var(--blue-100);
				padding: 2rem;
				text-align: center;
			}

			.dropzone.dragging {
				background-color: var(--blue-200);
			}

			.dropzone label[for='dataset-file'] {
				display: block;
				cursor: pointer;
				margin-block-end: 1rem;
				color: var(--stone-800);
				font-size: 1rem;
			}

			.file-picker {
				display: inline-flex;
				position: relative;
				margin-block-end: 1rem;
			}

			.file-picker .file-picker-button {
				display: inline-flex;
				justify-content: center;
				align-items: center;
				border: 1.5px solid var(--stone-250);
				border-bottom-width: 3px;
				border-radius: 0.5rem;
				background: var(--stone-150);
				padding: 0.5rem 1rem;
				min-height: 2.75rem;
				color: var(--stone-700);
				font: inherit;
				font-weight: 500;
			}

			.file-picker input[type='file'] {
				position: absolute;
				opacity: 0;
				cursor: pointer;
				inset: 0;
				width: 100%;
				height: 100%;
			}

			.file-picker:hover .file-picker-button {
				background: var(--blue-100);
			}

			.file-picker:has(input:focus-visible) .file-picker-button {
				outline: 3px solid;
				outline-color: var(--blue-700);
				outline-offset: 3px;
			}

			.requirements {
				margin: 0;
				color: var(--stone-700);
			}

			.requirements small {
				font-size: 0.8125rem;
			}

			.progress-section {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 1rem;
				padding-block: 1rem;
				text-align: center;
			}

			progress {
				inline-size: 100%;
				max-inline-size: 20rem;
				block-size: 0.75rem;
				accent-color: var(--blue-700);
			}

			p[role='alert'] {
				margin: 0;
				color: var(--red-700);
				font-weight: 500;
				font-size: 0.875rem;
			}
		`
	];

	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog') ?? null;
	}

	private invokerElement: HTMLElement | null = null;
	private stopHeaderObservation?: () => void;

	override disconnectedCallback(): void {
		this.stopHeaderObservation?.();
		super.disconnectedCallback();
	}

	@state() private accessor isDragging = false;

	/** Whether the upload modal dialog is open. */
	@property({ type: Boolean })
	accessor open = false;

	/** Whether an ingestion pipeline run is in progress. */
	@property({ type: Boolean })
	accessor busy = false;

	/** Active progress stats from the running ingestion pipeline. */
	@property({ attribute: false })
	accessor progress: IngestionProgress | null = null;

	/** Active error message string to display to the user. */
	@property({ attribute: false })
	accessor error: string | null = null;

	/** Localised string labels for upload dialog text. */
	@property({ attribute: false })
	accessor labels: UploadDialogLabels = {
		heading: '',
		file: '',
		requirements: '',
		phase: '',
		cancel: '',
		close: ''
	};

	/** Invoker element for explicit focus restoration. */
	@property({ attribute: false })
	accessor invoker: HTMLElement | null = null;

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);

		if (changedProperties.has('open')) {
			if (this.open && !this.dialogElement?.open) {
				this.invokerElement =
					this.invoker ?? (document.activeElement as HTMLElement) ?? null;
				try {
					this.dialogElement?.showModal();
				} catch {
					if (this.dialogElement) this.dialogElement.open = true;
				}
				if (this.dialogElement?.open) {
					this.stopHeaderObservation?.();
					this.stopHeaderObservation = observeDialogHeader(this.dialogElement);
				}
			} else if (!this.open && this.dialogElement?.open) {
				this.dialogElement.close();
				this.dialogElement.returnValue = '';
				this.invokerElement?.focus?.();
			}
		}
	}

	private handleNativeClose(): void {
		if (this.dialogElement) {
			this.dialogElement.returnValue = '';
		}
		if (this.busy) {
			this.dispatchEvent(
				new CustomEvent('app-upload-cancel', { bubbles: false, composed: false })
			);
		}
		if (this.open) {
			this.open = false;
			this.invokerElement?.focus?.();
			this.dispatchEvent(
				new CustomEvent('app-upload-close', { bubbles: false, composed: false })
			);
		}
	}

	private handleCloseClick(): void {
		this.open = false;
		if (this.busy) {
			this.dispatchEvent(
				new CustomEvent('app-upload-cancel', { bubbles: false, composed: false })
			);
		}
		if (this.dialogElement?.open) {
			this.dialogElement.close();
			this.dialogElement.returnValue = '';
		}
		this.invokerElement?.focus?.();
		this.dispatchEvent(
			new CustomEvent('app-upload-close', { bubbles: false, composed: false })
		);
	}

	private handleCancel(): void {
		this.dispatchEvent(
			new CustomEvent('app-upload-cancel', { bubbles: false, composed: false })
		);
	}

	private processFiles(files: FileList | null): void {
		if (!files || files.length === 0) return;
		if (files.length > 1) {
			this.error = 'Please select a single CSV file.';
			return;
		}
		const file = files[0];
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.csv')) {
			this.error = 'This CSV could not be read. Check the file and try again.';
			return;
		}
		this.error = null;
		this.dispatchEvent(
			new CustomEvent<{ file: File }>('app-upload-file-select', {
				detail: { file },
				bubbles: false,
				composed: false
			})
		);
	}

	private handleFileChange(e: Event): void {
		const input = e.target as HTMLInputElement;
		this.processFiles(input.files);
		input.value = '';
	}

	private handleDragOver(e: DragEvent): void {
		e.preventDefault();
		if (this.busy) return;
		this.isDragging = true;
	}

	private handleDragLeave(): void {
		this.isDragging = false;
	}

	private handleDrop(e: DragEvent): void {
		e.preventDefault();
		this.isDragging = false;
		if (this.busy) return;
		this.processFiles(e.dataTransfer?.files ?? null);
	}

	private renderProgress(): TemplateResult {
		const phaseKey = this.progress?.phase;
		const phaseText =
			this.labels.phase ||
			(phaseKey ? (INGESTION_PHASE_LABELS[phaseKey] ?? 'Processing…') : 'Loading dataset…');

		const hasBytes =
			this.progress && this.progress.totalBytes !== null && this.progress.totalBytes > 0;
		const hasRows =
			this.progress && this.progress.totalRows !== null && this.progress.totalRows > 0;

		let progressEl: TemplateResult;
		if (hasBytes) {
			progressEl = html`
				<progress
					id="load-progress"
					value=${this.progress!.bytesProcessed}
					max=${this.progress!.totalBytes!}></progress>
			`;
		} else if (hasRows) {
			progressEl = html`
				<progress
					id="load-progress"
					value=${this.progress!.rowsProcessed}
					max=${this.progress!.totalRows!}></progress>
			`;
		} else {
			progressEl = html`<progress id="load-progress"></progress>`;
		}

		return html`
			<div class="progress-section">
				<label for="load-progress">${phaseText}</label>
				${progressEl}
				<button type="button" class="btn" @click=${this.handleCancel}>
					${this.labels.cancel || 'Cancel'}
				</button>
			</div>
		`;
	}

	override render(): TemplateResult {
		return html`
			<dialog
				class="modal"
				aria-labelledby="upload-dialog-title"
				@close=${this.handleNativeClose}
				@cancel=${this.handleNativeClose}>
				<header class="modal-header">
					<h2 id="upload-dialog-title">
						${this.labels.heading || 'Upload Custom Dataset'}
					</h2>
					<button
						type="button"
						class="btn-icon"
						aria-label=${this.labels.close || 'Close modal'}
						@click=${this.handleCloseClick}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							aria-hidden="true"
							focusable="false">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</header>

				<div class="modal-content">
					${this.error ? html`<p role="alert">${this.error}</p>` : nothing}
					${this.busy ? this.renderProgress() : nothing}

					<section
						class="dropzone ${this.isDragging ? 'dragging' : ''}"
						@dragover=${this.handleDragOver}
						@dragleave=${this.handleDragLeave}
						@drop=${this.handleDrop}>
						<label for="dataset-file">
							${this.labels.file ||
							'Click to upload or drag and drop your dataset here.'}
						</label>
						<label class="file-picker">
							<span class="file-picker-button">Select file</span>
							<input
								type="file"
								id="dataset-file"
								name="dataset"
								accept=".csv,text/csv"
								?disabled=${this.busy}
								@change=${this.handleFileChange} />
						</label>
						<p class="requirements">
							<small>${this.labels.requirements || 'Must be .csv format.'}</small>
						</p>
					</section>
				</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-upload-dataset-dialog': AppUploadDatasetDialog;
	}
}
