import { LitElement, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { count } from '@nanostores/i18n';
import { StoreController } from '@nanostores/lit';
import { $format, i18n } from '../i18n';
import { buttonStyles } from '../styles/button.styles';
import { cardStyles } from '../styles/card.styles';

/**
 * Translations for the dataset card component.
 */
export const datasetCardMessages = i18n('app-dataset-card', {
	datasheet: 'Datasheet',
	loadDataset: 'Load Dataset',
	columns: count({
		one: '{count} column',
		many: '{count} columns'
	}),
	rows: count({
		one: '{count} row',
		many: '{count} rows'
	})
});

/**
 * Presentational dataset card rendering title, description, statistics and actions.
 * Follows specification/components/card.md and specification/plans/step-1-load-data-and-preview.md D1, D2.
 */
@customElement('app-dataset-card')
export class AppDatasetCard extends LitElement {
	static override readonly styles = [buttonStyles, cardStyles];

	private readonly i18nController = new StoreController(this, datasetCardMessages);

	/** Unique dataset identifier for typed domain identity. */
	@property({ type: String, attribute: 'dataset-id' })
	accessor datasetId = '';

	/** Display name of the dataset. */
	@property({ type: String })
	accessor name = '';

	/** Dataset description. */
	@property({ type: String })
	accessor description = '';

	/** Number of columns in dataset. */
	@property({ type: Number })
	accessor columns = 0;

	/** Number of rows in dataset. */
	@property({ type: Number })
	accessor rows = 0;

	private formatCompact(num: number): number {
		if (num === 1) return 1;
		return $format.get().number(num, { notation: 'compact' }) as unknown as number;
	}

	private handleDatasheet(e: MouseEvent): void {
		this.dispatchEvent(
			new CustomEvent<{ datasetId: string; name: string; invoker?: HTMLElement }>(
				'app-dataset-datasheet-open',
				{
					detail: {
						datasetId: this.datasetId,
						name: this.name,
						invoker: (e.currentTarget as HTMLElement) ?? undefined
					},
					bubbles: false,
					composed: false
				}
			)
		);
	}

	private handleSelect(): void {
		this.dispatchEvent(
			new CustomEvent<{ datasetId: string; name: string }>('app-dataset-select', {
				detail: { datasetId: this.datasetId, name: this.name },
				bubbles: false,
				composed: false
			})
		);
	}

	override render(): TemplateResult {
		const t = this.i18nController.value;
		const colText = t.columns(this.formatCompact(this.columns));
		const rowText = t.rows(this.formatCompact(this.rows));

		return html`
			<article class="card">
				<h3 class="card-title">${this.name}</h3>
				<p class="card-text">${this.description}</p>
				<p class="card-stats">
					<span class="stat">${colText}</span>
					${' '}
					<span class="stat">${rowText}</span>
				</p>
				<div class="card-actions">
					<button type="button" class="btn" @click=${this.handleDatasheet}>
						${t.datasheet}
					</button>
					<button type="button" class="btn btn-primary" @click=${this.handleSelect}>
						${t.loadDataset}
					</button>
				</div>
			</article>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-dataset-card': AppDatasetCard;
	}
}
