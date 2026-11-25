import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import type {
	ColumnStats,
	NumericColumnStats,
	CategoricalColumnStats,
	BooleanColumnStats,
	TextColumnStats
} from '../../types/dataset';
import { $format } from '../../i18n';
import { isTemporalColumnType } from '../../types/state';
import { formatTemporalValue, type TemporalColumnStats } from './temporal-format';

/** Labels for column details text. */
export interface ColumnDetailsLabels {
	close: string;
	type: string;
	missing: string;
	invalid: string;
	min: string;
	median: string;
	mean: string;
	max: string;
	histogram: string;
	range: string;
	count: string;
	category: string;
	frequency: string;
	/** Expansion for a supplied abbreviated categorical frequency label. */
	frequencyExpansion?: string;
	percentage: string;
	showAll: string;
	showFewer: string;
	distinct: string;
	identifier: string;
	true: string;
	false: string;
	earliest: string;
	latest: string;
	missingTokens: string;
	invalidExamples: string;
	notAvailable: string;
}

/**
 * Presentational panel displaying computed statistics and distributions for a selected column.
 * Follows specification/plans/step-1-load-data-and-preview.md D7.
 */
@customElement('app-column-details')
export class AppColumnDetails extends LitElement {
	static override readonly styles = [
		buttonStyles,
		css`
			:host {
				display: block;
			}

			.overlay {
				position: fixed;
				z-index: 50;
				box-sizing: border-box;
				inset-block-start: 0;
				inset-inline-end: 0;
				box-shadow: var(--shadow-panel);
				border-inline-start: 1px solid var(--stone-300);
				background-color: var(--stone-100);
				padding: 1rem;
				inline-size: 300px;
				max-inline-size: 100%;
				block-size: 100dvh;
				overflow-y: auto;
			}

			.overlay-title {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-block-end: 0.5rem;
			}

			.overlay-title h4 {
				margin: 0;
				color: var(--stone-900);
				font-weight: 600;
				font-size: 1.125rem;
				overflow-wrap: anywhere;
			}

			.btn-icon {
				display: inline-flex;
				justify-content: center;
				align-items: center;
				cursor: pointer;
				border: none;
				border-radius: 0.25rem;
				background: transparent;
				padding: 0.25rem;
				color: var(--stone-600);
			}

			.btn-icon:hover {
				background-color: var(--stone-200);
				color: var(--stone-900);
			}

			.btn-icon:focus-visible {
				outline: 2px solid;
				outline-color: var(--blue-700);
				outline-offset: 2px;
			}

			.icon {
				width: 1.25rem;
				height: 1.25rem;
			}

			code.type-tag {
				display: inline-block;
				margin-block-end: 0.5rem;
				border-radius: 0.25rem;
				background-color: var(--stone-200);
				padding: 0.125rem 0.375rem;
				color: var(--stone-800);
				font-weight: 600;
				font-size: 0.75rem;
				text-transform: uppercase;
			}

			.col-desc {
				margin-block: 0 0.5rem;
				color: var(--stone-700);
				font-size: 0.875rem;
				line-height: 1.4;
			}

			.summary-stats {
				margin-block: 0.5rem 1rem;
				border: 1px solid var(--stone-250);
				border-radius: 0.375rem;
				background-color: var(--stone-50);
				padding: 0.5rem;
				color: var(--stone-700);
				font-size: 0.8125rem;
			}

			.summary-stats p {
				margin: 0.25rem 0;
			}

			.table {
				margin-block: 0.5rem 1rem;
				border-collapse: collapse;
				inline-size: 100%;
				font-size: 0.8125rem;
			}

			.table th,
			.table td {
				border: 1px solid var(--stone-300);
				padding: 0.25rem 0.5rem;
				text-align: start;
			}

			.table th {
				background-color: var(--stone-200);
				color: var(--stone-800);
				font-weight: 600;
			}

			.table tr:nth-child(even) {
				background-color: var(--stone-50);
			}

			.table caption {
				margin-block-end: 0.25rem;
				color: var(--stone-800);
				font-weight: 600;
				text-align: start;
			}

			.badge {
				display: inline-block;
				margin-block-end: 0.5rem;
				border-radius: 0.25rem;
				background-color: var(--blue-100);
				padding: 0.25rem 0.5rem;
				color: var(--blue-700);
				font-weight: 500;
				font-size: 0.75rem;
			}

			.toggle-btn {
				cursor: pointer;
				margin-block-end: 0.5rem;
				border: 1px solid var(--stone-300);
				border-radius: 0.25rem;
				background: none;
				padding: 0.25rem 0.5rem;
				color: var(--stone-700);
				font-size: 0.75rem;
			}

			.toggle-btn:hover {
				background-color: var(--stone-200);
			}
		`
	];

	/** Column statistics data. */
	@property({ attribute: false })
	accessor column: ColumnStats | null = null;

	/** Column description when available. */
	@property({ type: String })
	accessor description = '';

	/** Total row count in dataset. */
	@property({ type: Number, attribute: 'row-count' })
	accessor rowCount = 0;

	/** Localised string labels. */
	@property({ attribute: false })
	accessor labels: ColumnDetailsLabels = {
		close: '',
		type: '',
		missing: '',
		invalid: '',
		min: '',
		median: '',
		mean: '',
		max: '',
		histogram: '',
		range: '',
		count: '',
		category: '',
		frequency: '',
		percentage: '',
		showAll: '',
		showFewer: '',
		distinct: '',
		identifier: '',
		true: '',
		false: '',
		earliest: '',
		latest: '',
		missingTokens: '',
		invalidExamples: '',
		notAvailable: ''
	};

	@state() private accessor expanded = false;

	private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape' && this.column) {
			e.stopPropagation();
			this.handleClose();
		}
	};

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener('keydown', this.onWindowKeyDown);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('keydown', this.onWindowKeyDown);
	}

	private handleClose(): void {
		this.dispatchEvent(
			new CustomEvent('app-column-details-close', {
				bubbles: false,
				composed: false
			})
		);
	}

	private handleKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.stopPropagation();
			this.handleClose();
		}
	}

	private renderNumericStats(col: NumericColumnStats): TemplateResult {
		const formatNum = (v: number, maxDigits = 2) =>
			$format.get().number(v, { useGrouping: true, maximumFractionDigits: maxDigits });

		const hist = col.histogram;
		const bins: Array<{ range: string; count: number }> = [];
		if (hist && hist.counts && hist.counts.length > 0) {
			for (let i = 0; i < hist.counts.length; i++) {
				const start = hist.start + i * hist.width;
				const end = start + hist.width;
				const count = hist.counts[i] ?? 0;
				bins.push({
					range: `${formatNum(start)}–${formatNum(end)}`,
					count
				});
			}
		}

		return html`
			${col.identifierHint
				? html`<div class="badge">${this.labels.identifier || 'Identifier candidate'}</div>`
				: nothing}

			<table class="table">
				<tbody>
					<tr>
						<th scope="row">${this.labels.min || 'Min'}</th>
						<td>${formatNum(col.min)}</td>
					</tr>
					<tr>
						<th scope="row">${this.labels.median || 'Median'}</th>
						<td>${formatNum(col.median)}</td>
					</tr>
					<tr>
						<th scope="row">${this.labels.mean || 'Mean'}</th>
						<td>${formatNum(col.mean, 4)}</td>
					</tr>
					<tr>
						<th scope="row">${this.labels.max || 'Max'}</th>
						<td>${formatNum(col.max)}</td>
					</tr>
				</tbody>
			</table>

			${bins.length > 0
				? html`
						<table class="table">
							<caption>
								${this.labels.histogram || 'Histogram bins'}
							</caption>
							<thead>
								<tr>
									<th scope="col">${this.labels.range || 'Range'}</th>
									<th scope="col">${this.labels.count || 'Count'}</th>
								</tr>
							</thead>
							<tbody>
								${bins.map(
									(b) => html`
										<tr>
											<td>${b.range}</td>
											<td>${formatNum(b.count)}</td>
										</tr>
									`
								)}
							</tbody>
						</table>
					`
				: nothing}
		`;
	}

	private renderCategoricalStats(col: CategoricalColumnStats): TemplateResult {
		const nonMissing = Math.max(1, this.rowCount - col.missingCount);
		const entries = Object.entries(col.categoryCounts);

		// Sort descending by frequency, then ascending by code-unit category name
		entries.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return a[0].localeCompare(b[0]);
		});

		const displayEntries = this.expanded ? entries : entries.slice(0, 50);
		const customFrequency = this.labels.frequency?.trim() ? this.labels.frequency : '';
		const frequency = customFrequency || 'Freq.';
		const expansion = customFrequency ? this.labels.frequencyExpansion?.trim() : 'Frequency';

		return html`
			<p>
				${this.labels.distinct || 'Distinct values'}:
				<strong>${$format.get().number(col.distinctCount)}</strong>
			</p>

			<table class="table">
				<thead>
					<tr>
						<th scope="col">${this.labels.category || 'Category'}</th>
						<th scope="col" aria-label=${expansion || nothing}>
							${expansion
								? html`<abbr title=${expansion}>${frequency}</abbr>`
								: frequency}
						</th>
						<th scope="col">${this.labels.percentage || '%'}</th>
					</tr>
				</thead>
				<tbody>
					${displayEntries.map(([cat, freq]) => {
						const pct = (freq / nonMissing) * 100;
						return html`
							<tr>
								<td>${cat}</td>
								<td>${$format.get().number(freq, { useGrouping: true })}</td>
								<td>${$format.get().number(pct, { maximumFractionDigits: 2 })}%</td>
							</tr>
						`;
					})}
				</tbody>
			</table>

			${entries.length > 50
				? html`
						<button
							type="button"
							class="toggle-btn"
							@click=${() => (this.expanded = !this.expanded)}>
							${this.expanded
								? this.labels.showFewer || 'Show fewer'
								: this.labels.showAll || 'Show all'}
						</button>
					`
				: nothing}
		`;
	}

	private renderBooleanStats(col: BooleanColumnStats): TemplateResult {
		const nonMissing = Math.max(1, this.rowCount - col.missingCount);
		const truePct = (col.trueCount / nonMissing) * 100;
		const falsePct = (col.falseCount / nonMissing) * 100;

		return html`
			<table class="table">
				<thead>
					<tr>
						<th scope="col">${this.labels.category || 'Value'}</th>
						<th scope="col">${this.labels.frequency || 'Count'}</th>
						<th scope="col">${this.labels.percentage || '%'}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>${this.labels.true || 'True'} (${col.lexicon[0]})</td>
						<td>${$format.get().number(col.trueCount, { useGrouping: true })}</td>
						<td>${$format.get().number(truePct, { maximumFractionDigits: 2 })}%</td>
					</tr>
					<tr>
						<td>${this.labels.false || 'False'} (${col.lexicon[1]})</td>
						<td>${$format.get().number(col.falseCount, { useGrouping: true })}</td>
						<td>${$format.get().number(falsePct, { maximumFractionDigits: 2 })}%</td>
					</tr>
				</tbody>
			</table>
		`;
	}

	private renderTemporalStats(col: TemporalColumnStats): TemplateResult {
		const earliestStr = formatTemporalValue(col.min, col);
		const latestStr = formatTemporalValue(col.max, col);
		const utc = col.type === 'datetime' ? ' (UTC)' : '';

		return html`
			<table class="table">
				<tbody>
					<tr>
						<th scope="row">${this.labels.earliest || `Earliest${utc}`}</th>
						<td>${earliestStr}</td>
					</tr>
					<tr>
						<th scope="row">${this.labels.latest || `Latest${utc}`}</th>
						<td>${latestStr}</td>
					</tr>
				</tbody>
			</table>
		`;
	}

	private renderTextStats(col: TextColumnStats): TemplateResult {
		return html`
			${col.identifierHint
				? html`<div class="badge">${this.labels.identifier || 'Identifier candidate'}</div>`
				: nothing}
			${col.distinctCount !== null
				? html`<p>
						${this.labels.distinct || 'Distinct values'}:
						<strong>${$format.get().number(col.distinctCount)}</strong>
					</p>`
				: nothing}
		`;
	}

	override render(): TemplateResult | typeof nothing {
		if (!this.column) return nothing;

		const col = this.column;

		return html`
			<aside class="overlay" aria-label="Column details" @keydown=${this.handleKeyDown}>
				<div class="overlay-title">
					<h4>${col.name}</h4>
					<button
						type="button"
						class="btn-icon"
						aria-label=${this.labels.close || 'Close'}
						@click=${this.handleClose}>
						<svg
							class="icon"
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
				</div>

				<code class="type-tag">${col.type}</code>
				${this.description ? html`<p class="col-desc">${this.description}</p>` : nothing}

				<div class="summary-stats">
					<p>
						${this.labels.missing || 'Empty'}:
						<strong>${$format.get().number(col.missingCount)}</strong>
					</p>
					<p>
						${this.labels.invalid || 'Invalid'}:
						<strong>${$format.get().number(col.invalidCount)}</strong>
					</p>
				</div>

				${col.type === 'numeric' ? this.renderNumericStats(col) : nothing}
				${col.type === 'categorical' ? this.renderCategoricalStats(col) : nothing}
				${col.type === 'boolean' ? this.renderBooleanStats(col) : nothing}
				${isTemporalColumnType(col.type)
					? this.renderTemporalStats(col as TemporalColumnStats)
					: nothing}
				${col.type === 'text' ? this.renderTextStats(col) : nothing}
			</aside>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-column-details': AppColumnDetails;
	}
}
