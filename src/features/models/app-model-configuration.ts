import {
	css,
	html,
	LitElement,
	noChange,
	nothing,
	type PropertyValues,
	type TemplateResult
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import {
	segmentDescription,
	type DescriptionSegment,
	type GlossaryTerm
} from '../../common/description-segments';
import {
	fromSliderPosition,
	parseNumberText,
	sliderBounds,
	toSliderPosition,
	type ScaleConfig
} from '../../common/parameter-scale';
import { buttonStyles } from '../../styles/button.styles';
import { hyperparametersStyles } from '../../styles/hyperparameters.styles';
import { trainModelStyles } from '../../styles/train-model.styles';
import type { ModelDocument, ModelOptionDocument } from '../../types/model-document';
import type {
	HyperparameterConfig,
	HyperparameterValue,
	MulticlassStrategy
} from '../../types/state';
import {
	normaliseModelOptions,
	numberInDomain,
	type ModelOptionContext,
	type NormalisedModelOptions
} from './model-options';
import {
	getOptionPolicy,
	resolveScale,
	type NumberDomain,
	type OptionPolicy
} from './model-presentation-policy';

/** Visible copy for one option. */
export interface OptionLabels {
	/** Field label. */
	name: string;
	/** Plain-English description; glossary terms found in it become `<abbr>`. */
	description: string;
	/** Translated glossary terms for this description. */
	terms: readonly GlossaryTerm[];
	/** Dependency notes keyed by the policy note key. */
	notes: Readonly<Record<string, string>>;
	/** `<option>` text of a compound field's mode select, keyed by mode. */
	choices?: Readonly<Record<string, string>>;
	/** Name of the value control of a compound field. */
	valueLabel?: string;
}

/** Pre-translated form chrome and option copy. */
export interface ConfigurationLabels {
	/** Accessible name of the form. */
	formLabel: string;
	/** Label of the Mode field. */
	mode: string;
	/** Description of the Mode field. */
	modeHelp: string;
	/** Mode option: manual configuration. */
	manual: string;
	/** Mode option: random search (disabled in this phase). */
	randomSearch: string;
	/** Submit button text. */
	saveContinue: string;
	/** Reset button text for an option. */
	reset: (name: string) => string;
	/** Add-layer button text. */
	addLayer: string;
	/** Remove-layer button text. */
	removeLayer: (layer: number) => string;
	/** Label of one layer-size input. */
	layerSize: (layer: number) => string;
	/** Label of the exact-value input beside a slider. */
	exactValue: (name: string) => string;
	/** Error texts keyed by message key, including `invalid-number`. */
	errors: Readonly<Record<string, string>>;
	/** Read-only notes for the multiclass strategy. */
	multiclassNotes: Readonly<Record<MulticlassStrategy, string>>;
	/** Copy per option name. */
	options: Readonly<Record<string, OptionLabels>>;
}

/** English fallback labels. The builder passes its translated copy. */
export const DEFAULT_CONFIGURATION_LABELS: ConfigurationLabels = {
	formLabel: 'Model settings',
	mode: 'Mode',
	modeHelp: 'Choose how the settings are selected.',
	manual: 'Manual',
	randomSearch: 'Random Search (advanced)',
	saveContinue: 'Save & Continue',
	reset: (name) => `Reset ${name}`,
	addLayer: 'Add layer',
	removeLayer: (layer) => `Remove layer ${layer}`,
	layerSize: (layer) => `Layer ${layer} size`,
	exactValue: (name) => `${name} (exact value)`,
	errors: { 'invalid-number': 'Enter a valid number.' },
	multiclassNotes: {
		native: 'This model handles more than two classes directly.',
		'one-vs-rest': 'More than two classes are handled by fitting one model per class.',
		'one-vs-one': 'More than two classes are handled by fitting one model per pair of classes.'
	},
	options: {}
};

/** Detail of `app-model-configuration-change`. */
export interface ModelConfigurationChangeDetail {
	/** Manual configuration with sparse canonical overrides. */
	config: HyperparameterConfig;
}

/** Detail of `app-model-configuration-continue`. */
export interface ModelConfigurationContinueDetail {
	/** Manual configuration with sparse canonical overrides. */
	config: HyperparameterConfig;
	/** Active overrides keyed for `web-ml`. */
	requestOptions: Readonly<Record<string, HyperparameterValue>>;
}

type EditState = { status: 'bad-input' } | { status: 'empty' } | { status: 'text'; text: string };

/** Mode keys of compound fields: [null-like mode, ...other modes]. */
const COMPOUND_CHOICES: Readonly<Record<string, readonly string[]>> = {
	maxDepth: ['unlimited', 'limited'],
	binarize: ['disabled', 'threshold'],
	gamma: ['scale', 'auto', 'value'],
	classWeight: ['none', 'balanced']
};

const LAYER_DOMAIN: NumberDomain = { integer: true, min: 1, messageKey: 'layer-sizes' };
const DEFAULT_LAYERS = [100];

/**
 * Manual model configuration form generated from a `web-ml` model document.
 * Presentational: edits leave through events and all text arrives through `labels`.
 * The form owns its draft text for number inputs so malformed input is preserved.
 * Follows specification/plans/web-ml-phase-1-configure-model.md Interfaces D.
 *
 * @fires app-model-configuration-change - A valid edit; `detail.config` holds the sparse overrides.
 * @fires app-model-configuration-continue - The form was submitted without errors.
 */
@customElement('app-model-configuration')
export class AppModelConfiguration extends LitElement {
	static override readonly styles = [
		buttonStyles,
		trainModelStyles,
		hyperparametersStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			.field-stack {
				display: flex;
				grid-area: control;
				flex-direction: column;
				gap: 0.5rem;
				min-width: 0;
			}

			.field-layers {
				grid-area: 1 / 1 / 3 / 2;
				margin: 0;
				border: 0;
				padding: 0;
				min-width: 0;

				> legend {
					margin-block-end: 0.5rem;
					padding: 0;
					font-weight: 600;
				}
			}

			.layer-row {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin-block-end: 0.5rem;

				> label {
					flex: 0 0 auto;
					font-size: 0.875rem;
				}

				> input {
					flex: 0 0 7rem;
					box-sizing: border-box;
					width: 7rem;
					min-width: 0;
				}
			}

			.form-notes {
				margin-block: 1rem;
			}

			.form-notes > p {
				margin: 0 0 0.5rem;
			}

			.form-actions {
				margin-block-start: 1rem;
			}
		`
	];

	/** Typed `web-ml` model document to render. */
	@property({ attribute: false }) accessor document: ModelDocument | null = null;
	/** Persisted configuration; `values` holds sparse canonical overrides. */
	@property({ attribute: false }) accessor value: HyperparameterConfig = {
		mode: 'manual',
		values: {}
	};
	/** Dataset facts that bound option values. */
	@property({ attribute: false }) accessor context: ModelOptionContext = {
		rowCount: 0,
		classCount: 0
	};
	/** Read-only multiclass strategy note, shown for more than two classes. */
	@property({ attribute: false }) accessor multiclass: MulticlassStrategy | null = null;
	/** Disables every control and suppresses both events. */
	@property({ type: Boolean }) accessor disabled = false;
	/** Pre-translated copy. */
	@property({ attribute: false }) accessor labels: ConfigurationLabels =
		DEFAULT_CONFIGURATION_LABELS;

	@state() private accessor working: Record<string, HyperparameterValue> = {};
	@state() private accessor edits: Readonly<Record<string, EditState>> = {};
	@state() private accessor errors: Readonly<Record<string, string>> = {};
	@state() private accessor showIssues = false;
	@state() private accessor announcement = '';

	private normalised: NormalisedModelOptions | null = null;
	private layerIds: string[] = [];
	private nextLayerId = 0;
	private lastDocument: ModelDocument | null = null;
	private pendingFocusKey: string | null = null;
	private pendingFocusInvalid = false;

	override willUpdate(changed: PropertyValues<this>): void {
		const document = this.document;
		if (changed.has('document') && this.lastDocument !== document) {
			this.lastDocument = document;
			this.edits = {};
			this.errors = {};
			this.showIssues = false;
			this.announcement = '';
			this.layerIds = [];
		}
		if (changed.has('value') || changed.has('document')) {
			this.working = { ...this.value.values };
		}
		if (!document) {
			this.normalised = null;
			return;
		}
		const normalised = normaliseModelOptions(document, this.working, this.context);
		this.normalised = normalised;
		this.syncLayerIds(this.layerSizes(normalised).length);
		this.pruneUnrenderedState(document, normalised);
	}

	override updated(): void {
		const root = this.renderRoot;
		if (this.pendingFocusKey !== null) {
			const key = this.pendingFocusKey;
			this.pendingFocusKey = null;
			root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
		}
		if (this.pendingFocusInvalid) {
			this.pendingFocusInvalid = false;
			root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	}

	// ---- derived state -------------------------------------------------------------------

	private policyOf(name: string): OptionPolicy | undefined {
		return this.document ? getOptionPolicy(this.document.id, name) : undefined;
	}

	private isActive(policy: OptionPolicy): boolean {
		return policy.activeWhen ? policy.activeWhen(this.normalised?.effective ?? {}) : true;
	}

	private layerSizes(normalised: NormalisedModelOptions): number[] {
		const sizes = normalised.effective.hiddenLayerSizes;
		return Array.isArray(sizes) && sizes.length > 0 ? sizes : DEFAULT_LAYERS;
	}

	private syncLayerIds(length: number): void {
		if (this.layerIds.length > length) this.layerIds = this.layerIds.slice(0, length);
		while (this.layerIds.length < length) {
			this.layerIds = [...this.layerIds, `layer-${this.nextLayerId++}`];
		}
	}

	/** Drops edit and error entries whose control is not currently rendered. */
	private pruneUnrenderedState(
		document: ModelDocument,
		normalised: NormalisedModelOptions
	): void {
		const rendered = new Set<string>();
		for (const option of document.options) {
			const policy = this.policyOf(option.name);
			if (!policy || !this.isActive(policy)) continue;
			const effective = normalised.effective[option.name];
			if (policy.kind === 'range' || policy.kind === 'number-reset')
				rendered.add(option.name);
			if (
				(policy.kind === 'nullable-mode' || policy.kind === 'gamma-mode') &&
				typeof effective === 'number'
			) {
				rendered.add(`${option.name}:value`);
			}
			if (policy.kind === 'layers') {
				for (const id of this.layerIds) rendered.add(`layer:${id}`);
			}
		}
		const keep = <T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> => {
			const keys = Object.keys(record);
			return keys.every((key) => rendered.has(key))
				? record
				: Object.fromEntries(
						keys.filter((key) => rendered.has(key)).map((key) => [key, record[key]!])
					);
		};
		this.edits = keep(this.edits);
		this.errors = keep(this.errors);
	}

	private nameOfKey(key: string): string {
		if (key.startsWith('layer:')) return 'hiddenLayerSizes';
		return key.endsWith(':value') ? key.slice(0, -6) : key;
	}

	private domainOfKey(key: string): NumberDomain | null {
		if (key.startsWith('layer:')) return LAYER_DOMAIN;
		const policy = this.policyOf(this.nameOfKey(key));
		if (
			policy?.kind === 'range' ||
			policy?.kind === 'number-reset' ||
			policy?.kind === 'nullable-mode' ||
			policy?.kind === 'gamma-mode'
		) {
			return policy.domain;
		}
		return null;
	}

	/** Returns the message key when an edit state is invalid, otherwise `null`. */
	private editError(key: string, edit: EditState): string | null {
		if (edit.status === 'bad-input' || edit.status === 'empty') return 'invalid-number';
		const domain = this.domainOfKey(key);
		const parsed = parseNumberText(edit.text);
		if (parsed === null || !domain) return 'invalid-number';
		return numberInDomain(parsed, domain, this.context) ? null : domain.messageKey;
	}

	private text(messageKey: string): string {
		return this.labels.errors[messageKey] ?? this.labels.errors['invalid-number'] ?? '';
	}

	private fieldError(name: string): string | null {
		const direct = this.errors[name] ?? this.errors[`${name}:value`];
		if (direct) return direct;
		if (name === 'hiddenLayerSizes') {
			const layerKey = Object.keys(this.errors).find((key) => key.startsWith('layer:'));
			if (layerKey) return this.errors[layerKey]!;
		}
		if (this.showIssues) {
			return this.normalised?.issues.find((issue) => issue.name === name)?.messageKey ?? null;
		}
		return null;
	}

	// ---- editing -------------------------------------------------------------------------

	private setEdit(key: string, edit: EditState | null): void {
		const next = { ...this.edits };
		if (edit) next[key] = edit;
		else delete next[key];
		this.edits = next;
	}

	private setError(key: string, messageKey: string | null): void {
		const next = { ...this.errors };
		if (messageKey) next[key] = messageKey;
		else delete next[key];
		this.errors = next;
	}

	/** Applies one canonical change and emits it. */
	private commit(name: string, value: HyperparameterValue | undefined): void {
		if (!this.document || this.disabled) return;
		const next = { ...this.working };
		if (value === undefined) delete next[name];
		else next[name] = value;
		this.working = { ...normaliseModelOptions(this.document, next, this.context).overrides };
		this.dispatchEvent(
			new CustomEvent<ModelConfigurationChangeDetail>('app-model-configuration-change', {
				detail: { config: this.buildConfig() }
			})
		);
	}

	private buildConfig(): HyperparameterConfig {
		return { ...this.value, mode: 'manual', values: { ...this.working } };
	}

	private commitKey(key: string, value: number): void {
		if (key.startsWith('layer:')) {
			const index = this.layerIds.indexOf(key.slice(6));
			if (index === -1 || !this.normalised) return;
			const sizes = [...this.layerSizes(this.normalised)];
			sizes[index] = value;
			this.commit('hiddenLayerSizes', sizes);
		} else {
			this.commit(this.nameOfKey(key), value);
		}
	}

	private scaleOf(name: string): ScaleConfig | null {
		const policy = this.policyOf(name);
		if (
			(policy?.kind === 'range' ||
				policy?.kind === 'nullable-mode' ||
				policy?.kind === 'gamma-mode') &&
			policy.scale
		) {
			return resolveScale(policy.scale, this.context);
		}
		return null;
	}

	private handleRangeInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const { key = '', name = '' } = input.dataset;
		const scale = this.scaleOf(name);
		if (!scale || this.disabled) return;
		this.setEdit(key, null);
		this.setError(key, null);
		this.commitKey(key, fromSliderPosition(Number(input.value), scale));
	}

	private handleNumberInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const { key = '', name = '' } = input.dataset;
		if (this.disabled) return;
		if (input.validity.badInput) {
			this.setEdit(key, { status: 'bad-input' });
			return;
		}
		if (input.value.trim() === '') {
			const policy = this.policyOf(name);
			if (policy?.kind === 'number-reset' && policy.blankIsOmitted) {
				this.setEdit(key, null);
				this.setError(key, null);
				this.commit(name, undefined);
			} else {
				this.setEdit(key, { status: 'empty' });
			}
			return;
		}
		const edit: EditState = { status: 'text', text: input.value };
		this.setEdit(key, edit);
		if (this.editError(key, edit) === null) {
			this.setError(key, null);
			this.commitKey(key, parseNumberText(input.value)!);
		}
	}

	private handleNumberBlur(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const key = input.dataset.key ?? '';
		const edit = this.edits[key];
		const messageKey = edit ? this.editError(key, edit) : null;
		this.setError(key, messageKey);
		this.announcement = messageKey ? this.text(messageKey) : '';
	}

	private handleReset(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const { key = '', name = '' } = button.dataset;
		this.setEdit(key, null);
		this.setError(key, null);
		const input = this.renderRoot.querySelector<HTMLInputElement>(
			`input[data-key="${CSS.escape(key)}"]`
		);
		if (input) input.value = '';
		this.commit(name, undefined);
	}

	private handleSelectChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		const name = select.dataset.name ?? '';
		this.commit(name, select.value);
	}

	private handleCheckboxChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		this.commit(input.dataset.name ?? '', input.checked);
	}

	private handleModeChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		const name = select.dataset.name ?? '';
		const policy = this.policyOf(name);
		const chosen = select.value;
		if (policy?.kind === 'nullable-mode') {
			this.commit(name, chosen === COMPOUND_CHOICES[name]![0] ? null : policy.startValue);
		} else if (policy?.kind === 'gamma-mode') {
			this.commit(name, chosen === 'value' ? policy.startValue : chosen);
		} else if (policy?.kind === 'class-weight') {
			this.commit(name, chosen === 'balanced' ? 'balanced' : null);
		}
	}

	private handleAddLayer(): void {
		if (!this.normalised || this.disabled) return;
		const id = `layer-${this.nextLayerId++}`;
		this.layerIds = [...this.layerIds, id];
		this.pendingFocusKey = `layer:${id}`;
		this.commit('hiddenLayerSizes', [...this.layerSizes(this.normalised), 100]);
	}

	private handleRemoveLayer(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const index = this.layerIds.indexOf(button.dataset.layer ?? '');
		if (index === -1 || !this.normalised || this.disabled) return;
		const sizes = this.layerSizes(this.normalised);
		if (sizes.length <= 1) return;
		const removed = this.layerIds[index]!;
		this.layerIds = this.layerIds.filter((_, i) => i !== index);
		const focusId = this.layerIds[index] ?? this.layerIds[index - 1];
		this.pendingFocusKey = focusId ? `layer:${focusId}` : null;
		this.setEdit(`layer:${removed}`, null);
		this.setError(`layer:${removed}`, null);
		this.commit(
			'hiddenLayerSizes',
			sizes.filter((_, i) => i !== index)
		);
	}

	private handleSubmit(event: Event): void {
		event.preventDefault();
		if (this.disabled || !this.normalised) return;
		const errors: Record<string, string> = { ...this.errors };
		let invalid = false;
		for (const [key, edit] of Object.entries(this.edits)) {
			const messageKey = this.editError(key, edit);
			if (messageKey) {
				errors[key] = messageKey;
				invalid = true;
			}
		}
		if (this.normalised.issues.length > 0) invalid = true;
		if (invalid) {
			this.errors = errors;
			this.showIssues = true;
			this.announcement = '';
			this.pendingFocusInvalid = true;
			return;
		}
		this.dispatchEvent(
			new CustomEvent<ModelConfigurationContinueDetail>('app-model-configuration-continue', {
				detail: {
					config: this.buildConfig(),
					requestOptions: this.normalised.requestOptions
				}
			})
		);
	}

	// ---- rendering -----------------------------------------------------------------------

	private optionLabels(name: string): OptionLabels {
		return this.labels.options[name] ?? { name, description: '', terms: [], notes: {} };
	}

	private displayText(key: string, canonical: number | undefined): string {
		const edit = this.edits[key];
		if (edit?.status === 'empty') return '';
		if (edit?.status === 'text') return edit.text;
		return canonical === undefined ? '' : String(canonical);
	}

	private renderSegments(segments: readonly DescriptionSegment[]): TemplateResult[] {
		return segments.map((segment) =>
			'abbr' in segment
				? html`<abbr title=${segment.title}>${segment.abbr}</abbr>`
				: html`${segment.text}`
		);
	}

	private renderDescription(name: string, policy: OptionPolicy | null): TemplateResult {
		const copy = this.optionLabels(name);
		const error = this.fieldError(name);
		const effective = this.normalised?.effective ?? {};
		const notes = (policy?.notes ?? []).filter((note) => !note.when || note.when(effective));
		return html`
			<div class="field-description">
				${error
					? html`<p id="${name}-error" class="field-error">${this.text(error)}</p>`
					: nothing}
				<div id="${name}-help">
					${copy.description
						? html`<p>
								${this.renderSegments(
									segmentDescription(copy.description, copy.terms)
								)}
							</p>`
						: nothing}
					${notes.map((note) =>
						copy.notes[note.key]
							? html`<p class="field-dependent">${copy.notes[note.key]}</p>`
							: nothing
					)}
				</div>
			</div>
		`;
	}

	private describedBy(name: string): string {
		return this.fieldError(name) ? `${name}-error ${name}-help` : `${name}-help`;
	}

	private invalid(name: string): 'true' | 'false' {
		return this.fieldError(name) ? 'true' : 'false';
	}

	private renderNumber(args: {
		id: string;
		name: string;
		key: string;
		canonical: number | undefined;
		step: string;
		min?: string;
		hiddenLabel?: string;
		layerLabel?: string;
		labelledBy?: string;
		invalid: boolean;
		describedBy: string;
	}): TemplateResult {
		const edit = this.edits[args.key];
		const bound =
			edit?.status === 'bad-input'
				? noChange
				: live(this.displayText(args.key, args.canonical));
		return html`
			${args.hiddenLabel
				? html`<label class="visually-hidden" for=${args.id}>${args.hiddenLabel}</label>`
				: nothing}
			<input
				id=${args.id}
				type="number"
				name=${args.name}
				step=${args.step}
				min=${args.min ?? nothing}
				data-name=${args.name}
				data-key=${args.key}
				aria-labelledby=${args.labelledBy ?? nothing}
				aria-invalid=${args.invalid ? 'true' : 'false'}
				aria-describedby=${args.describedBy}
				?disabled=${this.disabled}
				.value=${bound}
				@input=${this.handleNumberInput}
				@blur=${this.handleNumberBlur} />
		`;
	}

	private renderRange(
		name: string,
		key: string,
		scale: ScaleConfig,
		canonical: number | undefined,
		accessibleName: { labelledBy?: string; label?: string }
	): TemplateResult {
		const bounds = sliderBounds(scale);
		const position = toSliderPosition(canonical ?? scale.min, scale);
		return html`
			<input
				id="${key.replace(':', '-')}-range"
				type="range"
				min=${bounds.min}
				max=${bounds.max}
				step=${bounds.step}
				data-name=${name}
				data-key=${key}
				aria-labelledby=${accessibleName.labelledBy ?? nothing}
				aria-label=${accessibleName.label ?? nothing}
				aria-valuetext=${scale.scale === 'logarithmic' && canonical !== undefined
					? String(canonical)
					: nothing}
				aria-invalid="false"
				aria-describedby="${name}-help"
				?disabled=${this.disabled}
				.value=${String(position)}
				@input=${this.handleRangeInput} />
		`;
	}

	private renderResetButton(name: string, key: string): TemplateResult {
		return html`<button
			type="button"
			class="btn"
			data-name=${name}
			data-key=${key}
			?disabled=${this.disabled}
			@click=${this.handleReset}>
			${this.labels.reset(this.optionLabels(name).name)}
		</button>`;
	}

	private renderField(option: ModelOptionDocument): TemplateResult | typeof nothing {
		const policy = this.policyOf(option.name);
		if (
			!policy ||
			policy.kind === 'hidden' ||
			policy.kind === 'fixed' ||
			policy.kind === 'alias'
		) {
			return nothing;
		}
		if (!this.isActive(policy)) return nothing;
		const name = option.name;
		const copy = this.optionLabels(name);
		const effective = this.normalised?.effective[name];
		const invalid = this.fieldError(name) !== null;
		const label = html`<label
			class="field-name"
			id="${name}-label"
			for=${this.controlId(policy, name)}
			>${copy.name}</label
		>`;
		const description = this.renderDescription(name, policy);
		const describedBy = this.describedBy(name);
		const ariaInvalid = this.invalid(name);

		switch (policy.kind) {
			case 'select': {
				const disabledChoices =
					policy.disabledChoices?.(this.normalised?.effective ?? {}) ?? [];
				return html`<div class="field">
					${label}
					<select
						id=${name}
						name=${name}
						class="field-control"
						data-name=${name}
						aria-invalid=${ariaInvalid}
						aria-describedby=${describedBy}
						?disabled=${this.disabled}
						@change=${this.handleSelectChange}>
						${(option.enumValues ?? []).map(
							(choice) =>
								html`<option
									value=${String(choice)}
									?selected=${choice === effective}
									?disabled=${disabledChoices.includes(String(choice))}>
									${String(choice)}
								</option>`
						)}
					</select>
					${description}
				</div>`;
			}
			case 'checkbox':
				return html`<div class="field">
					${label}
					<input
						id=${name}
						name=${name}
						type="checkbox"
						class="field-control"
						data-name=${name}
						aria-invalid=${ariaInvalid}
						aria-describedby=${describedBy}
						?disabled=${this.disabled}
						.checked=${effective === true}
						@change=${this.handleCheckboxChange} />
					${description}
				</div>`;
			case 'range':
				return html`<div class="field">
					${label}
					<div class="field-controls" role="group" aria-labelledby="${name}-label">
						${this.renderRange(
							name,
							name,
							resolveScale(policy.scale, this.context),
							numberOrUndefined(effective),
							{
								labelledBy: `${name}-label`
							}
						)}
						${this.renderNumber({
							id: `${name}-number`,
							name,
							key: name,
							canonical: numberOrUndefined(effective),
							step:
								policy.scale &&
								resolveScale(policy.scale, this.context).scale === 'integer'
									? '1'
									: 'any',
							hiddenLabel: this.labels.exactValue(copy.name),
							invalid,
							describedBy
						})}
					</div>
					${description}
				</div>`;
			case 'number-reset':
				return html`<div class="field">
					${label}
					<div class="field-controls field-controls--with-action">
						${this.renderNumber({
							id: name,
							name,
							key: name,
							canonical: numberOrUndefined(effective),
							step: 'any',
							invalid,
							describedBy
						})}
						${this.renderResetButton(name, name)}
					</div>
					${description}
				</div>`;
			case 'nullable-mode':
			case 'gamma-mode':
			case 'class-weight':
				return this.renderCompound(
					name,
					policy,
					copy,
					effective,
					invalid,
					describedBy,
					ariaInvalid
				);
			case 'layers':
				return this.renderLayers(name, copy, description);
		}
	}

	private controlId(policy: OptionPolicy, name: string): string {
		switch (policy.kind) {
			case 'range':
				return `${name}-range`;
			case 'nullable-mode':
			case 'gamma-mode':
			case 'class-weight':
				return `${name}-mode`;
			case 'layers':
				return name;
			default:
				return name;
		}
	}

	private renderCompound(
		name: string,
		policy: OptionPolicy,
		copy: OptionLabels,
		effective: HyperparameterValue | undefined,
		invalid: boolean,
		describedBy: string,
		ariaInvalid: string
	): TemplateResult {
		const choices = COMPOUND_CHOICES[name] ?? [];
		const choiceText = (key: string): string => copy.choices?.[key] ?? key;
		let selected: string;
		let valueMode = false;
		if (policy.kind === 'nullable-mode') {
			valueMode = effective !== null && typeof effective === 'number';
			selected = valueMode ? choices[1]! : choices[0]!;
		} else if (policy.kind === 'gamma-mode') {
			valueMode = typeof effective === 'number';
			selected = valueMode ? 'value' : String(effective);
		} else {
			selected = effective === 'balanced' ? 'balanced' : 'none';
		}
		const valueLabel = copy.valueLabel ?? copy.name;
		const scale = this.scaleOf(name);
		const valueKey = `${name}:value`;
		const number = typeof effective === 'number' ? effective : undefined;
		return html`<div class="field">
			<label class="field-name" id="${name}-label" for="${name}-mode">${copy.name}</label>
			<div class="field-stack">
				<select
					id="${name}-mode"
					class="field-control"
					data-name=${name}
					aria-invalid=${valueMode ? 'false' : ariaInvalid}
					aria-describedby=${describedBy}
					?disabled=${this.disabled}
					@change=${this.handleModeChange}>
					${choices.map(
						(choice) =>
							html`<option value=${choice} ?selected=${choice === selected}>
								${choiceText(choice)}
							</option>`
					)}
				</select>
				${valueMode
					? html`<div
							class=${scale
								? 'field-controls'
								: 'field-controls field-controls--with-action'}
							role="group"
							aria-labelledby="${name}-label">
							${scale
								? this.renderRange(name, valueKey, scale, number, {
										label: valueLabel
									})
								: nothing}
							${this.renderNumber({
								id: `${name}-value-number`,
								name,
								key: valueKey,
								canonical: number,
								step: scale?.scale === 'integer' ? '1' : 'any',
								hiddenLabel: this.labels.exactValue(valueLabel),
								invalid,
								describedBy
							})}
							${scale ? nothing : this.renderResetButton(name, valueKey)}
						</div>`
					: nothing}
			</div>
			${this.renderDescription(name, policy)}
		</div>`;
	}

	private renderLayers(
		name: string,
		copy: OptionLabels,
		description: TemplateResult
	): TemplateResult {
		const sizes = this.normalised ? this.layerSizes(this.normalised) : DEFAULT_LAYERS;
		return html`<div class="field">
			<fieldset class="field-layers" aria-describedby="${name}-help">
				<legend>${copy.name}</legend>
				${repeat(
					this.layerIds,
					(id) => id,
					(id, index) => {
						const key = `layer:${id}`;
						const number = index + 1;
						return html`<div class="layer-row">
							<label for="${id}-input">${this.labels.layerSize(number)}</label>
							${this.renderNumber({
								id: `${id}-input`,
								name,
								key,
								canonical: sizes[index],
								step: '1',
								min: '1',
								invalid: this.errors[key] !== undefined,
								describedBy: this.errors[key]
									? `${name}-error ${name}-help`
									: `${name}-help`
							})}
							${sizes.length > 1
								? html`<button
										type="button"
										class="btn"
										data-layer=${id}
										?disabled=${this.disabled}
										@click=${this.handleRemoveLayer}>
										${this.labels.removeLayer(number)}
									</button>`
								: nothing}
						</div>`;
					}
				)}
				<button
					type="button"
					class="btn"
					?disabled=${this.disabled}
					@click=${this.handleAddLayer}>
					${this.labels.addLayer}
				</button>
			</fieldset>
			${description}
		</div>`;
	}

	override render(): TemplateResult {
		const document = this.document;
		if (!document || !this.normalised) return html`${nothing}`;
		const fixedNotes = document.options.flatMap((option) => {
			const policy = this.policyOf(option.name);
			if (policy?.kind !== 'fixed') return [];
			const copy = this.optionLabels(option.name);
			return (policy.notes ?? []).map((note) => copy.notes[note.key]).filter(Boolean);
		});
		const multiclassNote =
			this.context.classCount > 2 && this.multiclass
				? this.labels.multiclassNotes[this.multiclass]
				: null;
		return html`
			<form novalidate aria-label=${this.labels.formLabel} @submit=${this.handleSubmit}>
				<div class="field">
					<label for="mode" class="field-name">${this.labels.mode}</label>
					<select
						id="mode"
						name="mode"
						class="field-control"
						aria-invalid="false"
						aria-describedby="mode-help"
						?disabled=${this.disabled}>
						<option value="manual" selected>${this.labels.manual}</option>
						<option value="tuning" disabled>${this.labels.randomSearch}</option>
					</select>
					<div class="field-description">
						<div id="mode-help"><p>${this.labels.modeHelp}</p></div>
					</div>
				</div>
				${document.options.map((option) => this.renderField(option))}
				${multiclassNote || fixedNotes.length > 0
					? html`<div class="form-notes">
							${multiclassNote
								? html`<p class="form-note">${multiclassNote}</p>`
								: nothing}
							${fixedNotes.map((note) => html`<p class="form-note">${note}</p>`)}
						</div>`
					: nothing}
				<div class="visually-hidden" aria-live="polite">${this.announcement}</div>
				<div class="form-actions">
					<button type="submit" class="btn btn-primary" ?disabled=${this.disabled}>
						${this.labels.saveContinue}
					</button>
				</div>
			</form>
		`;
	}
}

function numberOrUndefined(value: HyperparameterValue | undefined): number | undefined {
	return typeof value === 'number' ? value : undefined;
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-configuration': AppModelConfiguration;
	}
}
