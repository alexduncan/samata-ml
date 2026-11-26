import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import { params } from '@nanostores/i18n';
import { i18n } from '../../i18n';
import { buttonStyles } from '../../styles/button.styles';
import { cardStyles } from '../../styles/card.styles';
import { chicletStyles } from '../../styles/chiclet.styles';

/**
 * Translations for the model card component.
 */
export const modelCardMessages = i18n('app-model-card', {
	modelDescription: 'Model Description',
	selectModel: 'Select Model',
	actionForModel: params<{ action: string; name: string }>('{action}: {name}'),
	selected: 'Selected',
	classification: 'Classification',
	regression: 'Regression',
	clustering: 'Clustering'
});

/** Model task classification kind. */
export type ModelCardType = 'classification' | 'regression' | 'clustering';

/**
 * Presentational model card rendering type badge, image slot, title, description and actions.
 * Follows specification/components/card.md and specification/plans/step-3-train-models-overview-and-setup.md D1, D3.
 *
 * @slot image - One decorative 5:3 img with empty alt text or one inline svg with viewBox 0 0 360 216.
 */
@customElement('app-model-card')
export class AppModelCard extends LitElement {
	static override readonly styles = [buttonStyles, cardStyles, chicletStyles];

	private readonly i18nController = new StoreController(this, modelCardMessages);

	/** Unique model identifier for typed domain identity. */
	@property({ type: String, attribute: 'model-id' })
	accessor modelId = '';

	/** Task kind for the model. */
	@property({ type: String })
	accessor type: ModelCardType = 'classification';

	/** Display name of the model. */
	@property({ type: String })
	accessor name = '';

	/** Model description. */
	@property({ type: String })
	accessor description = '';

	/** Whether this card is the current model choice. */
	@property({ type: Boolean })
	accessor selected = false;

	private handleDescription(event: MouseEvent): void {
		if (event.detail > 0 && event.currentTarget instanceof HTMLButtonElement) {
			// WebKit can activate the button without focusing it before the dialog opens.
			event.currentTarget.focus({ preventScroll: true });
		}
		this.dispatchEvent(
			new CustomEvent<{ modelId: string; name: string }>('app-model-description-open', {
				detail: { modelId: this.modelId, name: this.name },
				bubbles: false,
				composed: false
			})
		);
	}

	private handleSelect(): void {
		this.dispatchEvent(
			new CustomEvent<{ modelId: string; name: string }>('app-model-select', {
				detail: { modelId: this.modelId, name: this.name },
				bubbles: false,
				composed: false
			})
		);
	}

	override render(): TemplateResult {
		const t = this.i18nController.value;

		const chicletClass =
			this.type === 'regression'
				? 'chiclet chiclet-teal'
				: this.type === 'clustering'
					? 'chiclet chiclet-amber'
					: 'chiclet chiclet-purple';

		const typeLabel =
			this.type === 'regression'
				? t.regression
				: this.type === 'clustering'
					? t.clustering
					: t.classification;

		return html`
			<article class="card">
				<span class="card-type ${chicletClass}">${typeLabel}</span>
				<div class="card-image" aria-hidden="true"><slot name="image"></slot></div>
				<h3 class="card-title">${this.name}</h3>
				<p class="card-text">${this.description}</p>
				<div class="card-actions">
					<button
						type="button"
						class="btn"
						aria-label=${this.name
							? t.actionForModel({ action: t.modelDescription, name: this.name })
							: nothing}
						@click=${this.handleDescription}>
						${t.modelDescription}
					</button>
					<div class="card-selection">
						<button
							type="button"
							class="btn btn-primary"
							aria-label=${this.name
								? t.actionForModel({ action: t.selectModel, name: this.name })
								: nothing}
							aria-current=${this.selected ? 'true' : nothing}
							@click=${this.handleSelect}>
							${t.selectModel}
						</button>
						${this.selected
							? html`<span aria-hidden="true">${t.selected}</span>`
							: nothing}
					</div>
				</div>
			</article>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-card': AppModelCard;
	}
}
